var express = require('express');
var router = express.Router();
const homePageController=require('../controllers/homePageControl')

router.get('/',homePageController.getHomePage);


module.exports = router;