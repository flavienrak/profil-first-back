"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const socket_1 = require("./socket");
const auth_middleware_1 = require("./middlewares/auth.middleware");
const user_middleware_1 = require("./middlewares/role/user/user.middleware");
const recruiter_middleware_1 = require("./middlewares/role/recruiter/recruiter.middleware");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const all_user_routes_1 = __importDefault(require("./routes/all-user.routes"));
const user_role_routes_1 = __importDefault(require("./routes/role/user/user-role.routes"));
const cv_minute_routes_1 = __importDefault(require("./routes/role/user/cv-minute.routes"));
const quali_quarriere_routes_1 = __importDefault(require("./routes/role/user/quali-quarriere.routes"));
const cvtheque_routes_1 = __importDefault(require("./routes/role/recruiter/cvtheque.routes"));
socket_1.app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
socket_1.app.use('/api/*', auth_middleware_1.checkUser);
socket_1.app.get('/', (req, res) => {
    res.send('Backend running successfully!');
});
socket_1.app.use('/api/auth', auth_routes_1.default);
socket_1.app.use('/api/user', auth_middleware_1.isAuthenticated, all_user_routes_1.default);
// USER ROLE ROUTES
socket_1.app.use('/api/role/user', user_role_routes_1.default);
socket_1.app.use('/api/role/user/cv-minute', auth_middleware_1.isAuthenticated, user_middleware_1.checkUserRole, cv_minute_routes_1.default);
socket_1.app.use('/api/role/user/quali-carriere', auth_middleware_1.isAuthenticated, user_middleware_1.checkUserRole, quali_quarriere_routes_1.default);
// RECRUITER ROLE ROUTES
socket_1.app.use('/api/role/recruiter/cvtheque', auth_middleware_1.isAuthenticated, recruiter_middleware_1.checkIsRecruiter, cvtheque_routes_1.default);
const port = process.env.BACKEND_PORT || 5000;
socket_1.server.listen(port, () => socket_1.logger.info(`App runing at: ${port}`));
//# sourceMappingURL=index.js.map