"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_1 = require("./socket");
const auth_middleware_1 = require("./middlewares/auth.middleware");
const candidat_middleware_1 = require("./middlewares/role/candidat/candidat.middleware");
const recruiter_middleware_1 = require("./middlewares/role/recruiter/recruiter.middleware");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const cv_minute_routes_1 = __importDefault(require("./routes/role/candidat/cv-minute.routes"));
const quali_quarriere_routes_1 = __importDefault(require("./routes/role/candidat/quali-quarriere.routes"));
const cvtheque_routes_1 = __importDefault(require("./routes/role/recruiter/cvtheque.routes"));
const cross_sourcing_routes_1 = __importDefault(require("./routes/role/recruiter/cross-sourcing.routes"));
socket_1.app.use('/api/auth', auth_routes_1.default);
socket_1.app.use('/api/user', auth_middleware_1.isAuthenticated, user_routes_1.default);
socket_1.app.use('/api/payment', auth_middleware_1.isAuthenticated, payment_routes_1.default);
// CANDIDAT ROUTES
socket_1.app.use('/api/role/candidat/cv-minute', auth_middleware_1.isAuthenticated, candidat_middleware_1.checkUserRole, candidat_middleware_1.getCvMinuteCards, cv_minute_routes_1.default);
socket_1.app.use('/api/role/candidat/quali-carriere', auth_middleware_1.isAuthenticated, candidat_middleware_1.checkUserRole, candidat_middleware_1.checkQualiCarriere, quali_quarriere_routes_1.default);
// RECRUITER ROLE ROUTES
socket_1.app.use('/api/role/recruiter/cvtheque', auth_middleware_1.isAuthenticated, recruiter_middleware_1.checkIsRecruiter, cvtheque_routes_1.default);
socket_1.app.use('/api/role/recruiter/cross-sourcing', auth_middleware_1.isAuthenticated, recruiter_middleware_1.checkIsRecruiter, cross_sourcing_routes_1.default);
const port = process.env.BACKEND_PORT;
if (!port) {
    socket_1.logger.error('ENV NOT FOUND');
}
else {
    socket_1.server.listen(port, () => socket_1.logger.info(`App runing at: ${port}`));
}
//# sourceMappingURL=index.js.map