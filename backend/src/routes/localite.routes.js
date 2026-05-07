// Routes publiques — données géographiques de Tunisie
const router = require('express').Router();
const ctrl   = require('../controllers/localite.controller');

router.get('/gouvernorats', ctrl.getGouvernorats); // GET /api/localites/gouvernorats
router.get('/delegations',  ctrl.getDelegations);  // GET /api/localites/delegations?gouvernorat=X
router.get('/',             ctrl.getLocalites);     // GET /api/localites?gouvernorat=X&delegation=Y

module.exports = router;
