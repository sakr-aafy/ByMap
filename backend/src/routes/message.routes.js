// src/routes/message.routes.js
const router = require('express').Router();
const { protect } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/message.controller');

router.use(protect);

router.get('/conversations',  ctrl.getConversations);
router.get('/:userId',        ctrl.getConversation);
router.post('/',              ctrl.sendMessage);

module.exports = router;
