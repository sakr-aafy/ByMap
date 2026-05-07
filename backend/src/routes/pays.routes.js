const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/pays.controller');

router.get('/',          ctrl.getAll);
router.get('/:code',     ctrl.getOne);
router.get('/:code/cities', ctrl.getCities);

module.exports = router;
