var express = require('express'),
    bodyParser = require("body-parser"),
    mongoose = require("mongoose"),
    Comment = require("./models/comment"),
    Campground = require("./models/campground"),
    localStrategy = require("passport-local"),
    passport = require("passport"),
    User = require("./models/user"),
    methodOverride = require("method-override"),
    flash = require("connect-flash")
    


var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(flash());

//what to use when we want to override a method
app.use(methodOverride("_method"));

app.use(require("express-session")({
    //secret can be anything, used to decode and encode info about the session
    secret: "I love coding!",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

//for the local strategy, use User.authenticate that was created in the User model
passport.use(new localStrategy(User.authenticate()));

//decode and encode info, added these functions in the plugin of the User model
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//this middleware will be executed before every function
app.use(function(req, res, next){
   //passing the user into the variables of every response
   res.locals.currentUser = req.user;
   res.locals.error = req.flash("error");
   res.locals.success = req.flash("success");
   next();
});

mongoose.connect("mongodb://localhost/yelp_camp");

app.listen(4005, () => {
    console.log("YelpCamp App is running on port 4005.");
});



app.get("/", (req, res) => {
    res.render("landing");
});

app.get("/campgrounds", (req, res) => {

    Campground.find({}, (err, campgrounds) => {

        if(err)
         console.log(err);
        else
         res.render("index", {campgrounds: campgrounds, currentUser: req.user });
    });

});

app.post("/campgrounds",isLoggedIn, (req, res) => {

   //get data from form and add to campgrounds array
   var name = req.body.name;
   var image = req.body.image;
   var description = req.body.description;
   var author = {
       id: req.user._id,
       username: req.user.username
   }
   var newCampground = {name: name, image: image, description: description, author:author};

   Campground.create(
     
    newCampground
    ,
    (err, campground) => {

        if(err){
             
            console.log("We have an error in entering the campground");
            console.log(err);
        }
    }
)
   

   //redirect back to campgrounds page
   res.redirect("/campgrounds");
});

app.get("/campgrounds/new", isLoggedIn, (req, res) => {
   res.render("new.ejs");
});

app.get("/campgrounds/:id", (req, res) => {


    Campground.findById(req.params.id).populate("comments").exec( function(err, foundCamp){

        if(err)
        console.log(err);

        else{
            res.render("show", {campground: foundCamp});
        }
        

    }); 
});

app.get("/campgrounds/:id/comments/new", isLoggedIn, (req, res) => {
    
    Campground.findById(req.params.id, (err, camp) => {

        if(err)
        console.log(err);

        else{
            res.render("newComment", {campground: camp});
         }
        
    });
    
});

//using middleware here so a hacker can't send a post request
app.post("/campgrounds/:id/comments", isLoggedIn, (req, res) => {

    Campground.findById(req.params.id, (err, camp) => {

        if(err){
            console.log(err);
            res.redirect("/campgrounds");
        }
        
        else{
            Comment.create(req.body.comment, (err, comment) => {

                if(err)
                console.log(err);

                else{
                    comment.author.id = req.user._id;
                    comment.author.username = req.user.username;
                    comment.save();

                    camp.comments.push(comment);
                    camp.save();
                    res.redirect('/campgrounds/' + camp._id);
                }
            });
            
        }
    });

});

//EDIT CAMPGROUND

app.get("/campgrounds/:id/edit", checkCampgroundOwnership, (req, res) => {
  
    Campground.findById(req.params.id, (err, foundCampground) => {

            res.render("edit", {campground: foundCampground});

    });

});

//UPDATE CAMPGROUND

app.put("/campgrounds/:id", checkCampgroundOwnership, (req, res) => {

    Campground.findByIdAndUpdate(req.params.id, req.body.camp, (err, campground) => {

        if(err)
          res.redirect("/campgrounds");
        else{
            res.redirect("/campgrounds");
        }
    });
});

//DELETE CAMPGROUND

app.delete("/campgrounds/:id", checkCampgroundOwnership,(req, res) => {
  Campground.findByIdAndRemove(req.params.id, (err) => {

    if(err)
      res.redirect("/campgrounds/"+ req.params.id);
    else
      res.redirect("/campgrounds");
  })
});
//AUTH ROUTES

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", (req, res) => {

    //User.register creates new user with this username, and then hashes the password and stores it in the DB
    User.register(new User({username: req.body.username}), 
                   req.body.password, (err, user) => {

                    if(err){
                        console.log(err);
                        return res.render("register");
                    }
                    
                    //logs the user in, stores hashed password, and 'salt' wich helps unhash it
                    passport.authenticate("local")( req, res, function(){
                      res.redirect("/campgrounds");
                    });
                 });

});

//LOGIN routes

app.get("/login", (req, res) => {
    res.render("login");
});

//added authenticate middleware, passport automatically takes the body username and pw and compares them to DB
app.post("/login",passport.authenticate("local", {

    successRedirect: "/campgrounds",
    failureRedirect: "/login" 

}), (req, res) => {

});

//LOGOUT routes
app.get("/logout", (req, res) => {
    //passport destroys user info in the session
    req.flash("success", "Successfully logged out.");
    req.logout();
    res.redirect("/campgrounds");
});

//middleware

function isLoggedIn( req, res, next){
    if(req.isAuthenticated())
    return next();

    req.flash("error", "Please Login First");
    res.redirect("/login");
};

function checkCampgroundOwnership(req, res, next){
    if(req.isAuthenticated()){

        Campground.findById(req.params.id, (err, foundCampground) => {

            if(err)
              res.redirect("/campgrounds");
            else{
                 
                if(foundCampground.author.id.equals(req.user._id))
                   next();
                else{
                    req.flash("error", "You don't have permission to do that");
                    res.redirect("back");
                }
                   
            }
             
        });
    

    }
    else{
        req.flash("error", "You need to be logged in");
        res.redirect("back"); //sends user back to where he was
    }
}
