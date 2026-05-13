// src/controllers/message.controller.js
const Message  = require('../models/Message.model');
const User     = require('../models/User.model');
const { sendPush } = require('../services/push.service');

// GET /api/messages/:userId  — conversation entre l'utilisateur connecté et :userId
exports.getConversation = async (req, res) => {
  try {
    const me    = req.user.id;
    const other = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: me,    receiver: other },
        { sender: other, receiver: me    },
      ],
    })
      .sort({ createdAt: 1 })
      .populate('sender',   'prenom nom avatarUrl')
      .populate('receiver', 'prenom nom avatarUrl');

    // Marquer les messages reçus comme lus
    await Message.updateMany(
      { sender: other, receiver: me, read: false },
      { read: true }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/messages  — envoyer un message
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    if (!receiverId || !content?.trim())
      return res.status(400).json({ message: 'receiverId et content requis' });

    const msg = await Message.create({
      sender:   req.user.id,
      receiver: receiverId,
      content:  content.trim(),
    });

    const populated = await msg.populate([
      { path: 'sender',   select: 'prenom nom avatarUrl' },
      { path: 'receiver', select: 'prenom nom avatarUrl' },
    ]);

    // Notify receiver (fire-and-forget)
    (async () => {
      try {
        const receiver = await User.findById(receiverId).select('pushToken prenom nom');
        if (receiver?.pushToken) {
          const senderName = `${populated.sender.prenom || ''} ${populated.sender.nom || ''}`.trim() || 'Quelqu\'un';
          await sendPush(receiver.pushToken, `Message de ${senderName}`, content.trim().slice(0, 100), { screen: 'Messages', params: { userId: req.user.id } });
        }
      } catch {}
    })();

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/messages/conversations  — liste des conversations (dernier message par contact)
exports.getConversations = async (req, res) => {
  try {
    const me = req.user.id;

    const messages = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: me },
            { receiver: me },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', me] },
              '$receiver',
              '$sender',
            ],
          },
          lastMessage: { $first: '$$ROOT' },
          unread: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiver', me] }, { $eq: ['$read', false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Populate contact info
    const User = require('../models/User.model');
    const result = await Promise.all(
      messages.map(async (conv) => {
        const contact = await User.findById(conv._id).select('prenom nom avatarUrl');
        return { contact, lastMessage: conv.lastMessage, unread: conv.unread };
      })
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
