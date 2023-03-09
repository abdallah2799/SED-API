const User = require('../models/User');
const bcrypt = require('bcrypt');
const dataCryption = require('../dataEncrypt/dataEncryption');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');


exports.registerController = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(error => error.msg);
            res.status(400).json({ message: errorMessages });
            return;
        }

        const { firstname, lastname, username, email, password, phone, address, city, country } = req.body;

        const userExists = await User.exists({ email });
        if (userExists) {
            res.status(409).json({ message: 'Email address is already registered' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            firstName: dataCryption.encryptData(firstname),
            lastName: dataCryption.encryptData(lastname),
            userName: username,
            email,
            password: hashedPassword,
            phone,
            address: dataCryption.encryptData(address),
            city: dataCryption.encryptData(city),
            country: dataCryption.encryptData(country),
        });

        const doc = await newUser.save();
        res.status(201).json({ message: 'Registration successful', user: doc });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', Errors: error });
    }
};


exports.loginController = async (req, res, next) => {
    const { loginOption, password } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => error.msg);
        res.status(500).json({ message: errorMessages });
        return;
    }
    try {
        const user = await User.findOne({ $or: [{ email: loginOption }, { phone: loginOption }] });
        if (!user) {
            res.status(404).json({ message: "User doesn't exist" });
            return;
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            res.status(404).json({ message: "Wrong password" });
            return;
        }
        const decryptedData = {
            _id: user._id,
            fullname: dataCryption.decryptdData(user.firstName) + ' ' + dataCryption.decryptdData(user.lastName),
            username: user.userName,
            email: user.email,
            created: user.created
        };
        const expiresIn = "10h";
        const token = jwt.sign(decryptedData, process.env.SECRET_KEY, { expiresIn });
        res.status(200).json({ message: 'Logged in successfully', token, User: decryptedData });
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: error.message });
    }
};


exports.googleLogin = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.passport.user);
        if (!user) {
            res.status(404).json({ message: "User doesn't exist" });
            return;
        }
        console.log(user)
        const decryptedData = {
            _id: user._id,
            fullname: dataCryption.decryptdData(user.firstName) + ' ' + dataCryption.decryptdData(user.lastName),
            username: user.userName,
            email: user.email,
            created: user.created
        };
        const expiresIn = "10h";
        const token = jwt.sign(decryptedData, process.env.SECRET_KEY, { expiresIn });
        res.status(200).json({ message: 'Logged in successfully', token, User: decryptedData });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.forgetPassword = async (req, res, next) => {
    try {
        const searchOption = req.body.resetOption;

        if (!searchOption) {
            return res.status(400).json({ message: 'Email or Phone-Number is required' });
        }

        const user = await User.findOne({ $or: [{ email: searchOption }, { phone: searchOption }] });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const token = crypto.randomBytes(20).toString('hex');
        const expires = Date.now() + 3600000; // 1 hour

        user.resetPasswordToken = token;
        user.resetPasswordExpires = expires;

        await user.save();

        const transporter = nodemailer.createTransport({
            service: "hotmail",
            auth: {
                user: process.env.MYMAIL,
                pass: process.env.MAILPASSWORD
            }
        });
        const link = `http://${req.headers.host}/auth/reset/${token}`;

        const mailOptions = {
            to: user.email,
            from: process.env.MYMAIL,
            subject: 'Password Reset Request',
            html: `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <title>Password Reset Request</title>
    <style type="text/css">
      /* Set default font styles */
      body {
        font-family: Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #333;
      }
      /* Center the content */
      .container {
        max-width: 600px;
        margin: 0 auto;
      }
      /* Add styles to the logo */
      .logo {
        display: block;
        margin: 20px auto;
        max-width: 200px;
        border-radius: 50%;
        overflow: hidden;
      }
      /* Add styles to the subject */
      .subject {
        font-size: 14px;
        font-weight: bold;
        margin-top: 30px;
        text-align: center;
      }
      /* Add styles to the message content */
      .message {
        margin-top: 20px;
      }
      /* Add styles to the footer */
      .footer {
        margin-top: 40px;
        font-size: 12px;
        color: #999;
        text-align: center;
      }
    </style>
  </head>
      <body>
      <div class="container">
        <img class="logo" src="https://i.pinimg.com/564x/5e/86/9a/5e869a2d0a996d1a16cba2e89fa37305.jpg" alt="Logo" />
        <h4 class="subject">Password Reset Request</h4>
        <div class="message">
        <p>You are receiving this email because you (or someone else) have requested to reset the password for your account.</p>
        <p>Please click on the following link, or paste it into your browser to reset your password</p>
        <p><a href="${link}">CLICK HERE</a></p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        <p>Regards,</p>
        <p>The SED App Team</p>
        </div>
        <div class="footer">
        <p>Copyright © 2023 My App Name.
        </p>
      </div>
        </div>
      </body>
    </html>
  `
        };
        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: 'Email sent' });
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' });
    }
};


exports.resetPassword = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(error => error.msg);
            return res.status(400).json({ message: errorMessages });
        }

        const password = req.body.password;
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(404).json({ message: 'Invalid or expired token' });
        }

        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        const transporter = nodemailer.createTransport({
            service: "hotmail",
            auth: {
                user: process.env.MYMAIL,
                pass: process.env.MAILPASSWORD
            }
        });

        const mailOptions = {
            to: user.email,
            from: process.env.MYMAIL,
            subject: 'Your password has been changed',
            html: `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <title>Password Reset Done</title>
    <style type="text/css">
      /* Set default font styles */
      body {
        font-family: Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #333;
      }
      /* Center the content */
      .container {
        max-width: 600px;
        margin: 0 auto;
      }
      /* Add styles to the logo */
      .logo {
        display: block;
        margin: 20px auto;
        max-width: 200px;
        border-radius: 50%;
        overflow: hidden;
      }
      /* Add styles to the subject */
      .subject {
        font-size: 14px;
        font-weight: bold;
        margin-top: 30px;
        text-align: center;
      }
      /* Add styles to the message content */
      .message {
        margin-top: 20px;
      }
      /* Add styles to the footer */
      .footer {
        margin-top: 40px;
        font-size: 12px;
        color: #999;
        text-align: center;
      }
    </style>
  </head>
      <body>
      <div class="container">
        <img class="logo" src="https://i.pinimg.com/564x/5e/86/9a/5e869a2d0a996d1a16cba2e89fa37305.jpg" alt="Logo" />
        <h4 class="subject">Password Reset Done</h4>
        <div class="message">
        <p>Hello,</p>
        <p>This is a confirmation that the password for your account ${user.email} has just been changed.</p>
        <p>Regards,</p>
        <p>The SED App Team</p>
        </div>
        <div class="footer">
        <p>Copyright © 2023 My App Name.
        </p>
      </div>
        </div>
      </body>
    </html>
  `
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ message: 'Password changed' });
    } catch (err) {
        return res.status(500).json({ message: 'Server Error' });
    }
};


// text: 'Hello,\n\n' +
//                 'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'