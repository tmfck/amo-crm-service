import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {AuthController} from "./auth.controller.js";
import {AmoCrmService} from "./amo-crm.service.js";
import {ContactsController} from "./contacts.controller.js";

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AuthController, ContactsController],
  providers: [AmoCrmService],
})

export class AppModule {}
