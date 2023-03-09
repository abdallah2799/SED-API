require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
require('./api/config/passport-setup');
var path = require('path');
var logger = require('morgan');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
var cors=require('cors');
const cookieSession = require('cookie-session');
const session = require('express-session');
const passport = require('passport');
const nodemailer = require('nodemailer');

//defineing Routers
var homeRouter = require('./api/routes/home');
var productsRouter = require('./api/routes/products');
var authRouter = require('./api/routes/auth');
var usersRouter = require('./api/routes/users');

var app = express();

//connecting Database
mongoose.set('strictQuery', true);
mongoose.connect('mongodb+srv://abdullah_7:ilovenokia3300@testmongo.rl87aju.mongodb.net/SED', { useNewUrlParser: true, useUnifiedTopology: true }).
  then(() => { console.log('Connected to DB') }).
  catch(err => { console.log(err); });

// Parse incoming requests
app.use(cors());
app.use(bodyParser.json());
app.use(logger('dev'));
app.use(express.json());
app.use(session({
  secret: process.env.SECRET_KEY,
  resave: true,
  saveUninitialized: false
}));

// initialize passport
app.use(passport.initialize());
app.use(passport.session());

app.use(express.urlencoded({ extended: false }));


// image folder for multer
app.use(express.static(path.join(__dirname,'SEDimages')));

//using Routers
app.use('/', homeRouter);
app.use('/products', productsRouter);
app.use('/auth', authRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  //show the error
  res.status(err.status || 500).json({message:err.message});
  ;
});

module.exports = app;
