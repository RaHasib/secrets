//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require ('mongoose-findorcreate');
const HttpsProxyAgent = require('https-proxy-agent');


const app = express();

app.use(express.static("public"));

app.set("view engine", "ejs");

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

//session

app.use(
  session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

///Mongoose- to Connect our Database////

mongoose.connect("mongodb://localhost:27017/userDB", { useNewUrlParser: true });

mongoose.set("useCreateIndex", true);

//set Up new User Database///

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId:String,
  secret: String
});



userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);




const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });


//Google Auth this section first part is old


// passport.use(new GoogleStrategy({
//     clientID: process.env.CLIENT_ID,
//     clientSecret: process.env.CLIENT_SECRET,
//     callbackURL: "http://localhost:3000/auth/google/secrets",
//     userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
//   },
//   function(accessToken, refreshToken, profile, cb) {
//     User.findOrCreate({ googleId: profile.id }, function (err, user) {
//         console.log(profile);
//       return cb(err, user);
//     });
//   }
// ));

///new google auth with setting up the proxy.

const gStrategy = new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
    return cb(err, user);
    });
    }
    );
    const agent = new HttpsProxyAgent(process.env.HTTP_PROXY || "http://127.0.0.1:7890");
    gStrategy._oauth2.setAgent(agent);

    passport.use(gStrategy);





///end///

app.get("/", function (req, res) {
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
  );

  app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  });



app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});
app.get("/secrets", function(req, res){
  User.find({"secret": {$ne: null}}, function(err, foundUsers){
    if (err){
      console.log(err);
    } else {
      if (foundUsers) {
        res.render("secrets", {usersWithSecrets: foundUsers});
      }
    }
  });
});



//submit to secret

app.get("/submit", function(req,res){
    if (req.isAuthenticated()) {
        res.render("submit");
      } else {
        res.redirect("/login");
      }
});


app.post("/submit", function(req,res){
    const submittedSecret = req.body.secret;

    console.log(req.user.id);

    User.findById(req.user.id, function(err, foundUser){
        if(err){
            console.log(err);
        }else{
            if(foundUser){
                foundUser.secret = submittedSecret;
                foundUser.save(function(){
                    res.redirect("/secrets");
                });
            }
        }
    });
});


///End//

app.get("/logout", function(req,res){
     req.logout();
     res.redirect("/");
});



//register Route

app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    }
  );
});

//login Route

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });
    }
  });
});

app.listen(3000, function () {
  console.log("Server started on port 3000");
});
