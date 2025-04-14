"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const socket_1 = require("./socket");
const auth_middleware_1 = require("./middlewares/auth.middleware");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const cv_minute_routes_1 = __importDefault(require("./routes/cv-minute.routes"));
socket_1.app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, 'uploads')));
socket_1.app.use('/api/*', auth_middleware_1.checkUser);
socket_1.app.get('/', (req, res) => {
    res.send('Backend running successfully!');
});
socket_1.app.get('/api/jwtid', auth_middleware_1.requireAuth);
socket_1.app.use('/api/auth', auth_routes_1.default);
socket_1.app.use('/api/user', auth_middleware_1.isAuthenticated, user_routes_1.default);
socket_1.app.use('/api/cv-minute', auth_middleware_1.isAuthenticated, cv_minute_routes_1.default);
const port = process.env.BACKEND_PORT || 5000;
socket_1.server.listen(port, () => socket_1.logger.info(`App runing at: ${port}`));
//# sourceMappingURL=index.js.map