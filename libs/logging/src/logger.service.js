"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppLogger = void 0;
const common_1 = require("@nestjs/common");
let AppLogger = class AppLogger {
    constructor() {
        this.logger = new common_1.Logger('ATY');
    }
    log(message, ...optionalParams) {
        this.logger.log(message, ...optionalParams);
    }
    error(message, ...optionalParams) {
        this.logger.error(message, ...optionalParams);
    }
    warn(message, ...optionalParams) {
        this.logger.warn(message, ...optionalParams);
    }
    debug(message, ...optionalParams) {
        this.logger.debug?.(message, ...optionalParams);
    }
    verbose(message, ...optionalParams) {
        this.logger.verbose?.(message, ...optionalParams);
    }
};
exports.AppLogger = AppLogger;
exports.AppLogger = AppLogger = __decorate([
    (0, common_1.Injectable)()
], AppLogger);
