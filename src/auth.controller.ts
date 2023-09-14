import { Controller, Get, Query } from '@nestjs/common';
import {AmoCrmService} from './amo-crm.service.js';

@Controller('auth')
export class AuthController {
    constructor(private readonly amoCrmService: AmoCrmService) {}

    @Get()
    async auth(@Query('code') code: string): Promise<object> {
        await this.amoCrmService.getAccessToken(code);

        return {
            status: 'OK',
            statusCode: 200,
            error: null,
        };
    }
}
