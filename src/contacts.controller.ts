import {AmoCrmService, ContactDataDto} from "./amo-crm.service.js";
import {Controller, Get, Query} from "@nestjs/common";

@Controller('contacts')
export class ContactsController {
    constructor(private readonly amoCrmService: AmoCrmService) {}

    @Get('init')
    async testMethod(
        @Query('name') name: string,
        @Query('email') email: string,
        @Query('phone') phone: string,
    ) {
        const contactData: ContactDataDto = {
            name,
            email,
            phone
        };
        const contactId = await this.amoCrmService.createOrUpdateContact(contactData);

        const leadData = {
            "name": "Сделка для примера 1",
            "created_by": 0,
            "price": 80000
        };

        return await this.amoCrmService.createLeadWithContact(contactId, leadData);
    }
}
