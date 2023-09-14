import {HttpException, Injectable} from '@nestjs/common';
import fetch, {Response} from 'node-fetch';

enum CustomFields {
    phone = 2240007,
    email = 2240009,
}

type TokenInfo = {
    token_type: string,
    expires_in: number,
    access_token: string,
    refresh_token: string,
};

export type ContactDataDto = {
    name: string,
    email: string,
    phone: string,
}

export type ContactData = {
    name: string,
    custom_fields_values:  {
        field_id: number,
        values: [
            {
                value: string
            }
        ]
    }[]
}

type ContactsResponse = {
    _links: object,
    _embedded: {
        contacts: [
            {
                id: number
            }
        ]
    }
}

@Injectable()
export class AmoCrmService {
    private readonly amoApiUrl: string = process.env.AMO_API_URL || 'https://subdomain.amocrm.ru/';
    private readonly clientId: string = process.env.AMO_CLIENT_ID || '';
    private readonly clientSecret: string = process.env.AMO_CLIENT_SECRET || '';
    private readonly redirectUri: string = process.env.AMO_REDIRECT_URI || '';

    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private expiresIn: number | null = null;

    async checkStatus(response: Response) {
        if (response.ok) { // response.status >= 200 && response.status < 300
            return response;
        } else {
            let error: string | object;
            if (response.headers.get('content-type')?.includes('json')) {
                error = await response.json() as object;
            } else {
                error = await response.text();
            }
            console.error(error);
            throw new HttpException({
                status: response.status,
                error,
            }, response.status, {
                cause: new Error(),
            });
        }
    }
    
    async getAccessToken(code: string): Promise<void> {
        const body = {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: this.redirectUri,
        };
        await this.fetchTokens(body);
    }

    private async refreshTokenIfNeeded(): Promise<void> {
        if (this.accessToken && this.expiresIn && this.expiresIn <= +new Date()) {
            const body = {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'refresh_token',
                refresh_token: this.refreshToken,
                redirect_uri: this.redirectUri,
            };
            await this.fetchTokens(body);
        }
    }

    private async fetchTokens(body: object): Promise<void> {
        const response = await fetch(`${this.amoApiUrl}oauth2/access_token`, {
            method: 'post',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        await this.checkStatus(response);
        const data: TokenInfo = await response.json() as TokenInfo;
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.expiresIn = +new Date() + data.expires_in * 1e3;
    }

    async getContactByPhone(phone: string): Promise<any> {
        await this.refreshTokenIfNeeded();

        const response = await fetch(
            `${this.amoApiUrl}api/v4/contacts?query=${phone}`,
            {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
            }
        );
        await this.checkStatus(response);

        let result = await response.text();

        if (!result || !result.length) {
            return null;
        }

        if (response.headers.get('content-type')?.includes('json')) {
            let data = JSON.parse(result) as ContactsResponse;
            if (!data._embedded.contacts || !data._embedded.contacts.length) {
                return null;
            }
            return data._embedded.contacts[0];
        }
        return result;
    }

    async createOrUpdateContact(contactDataDto: ContactDataDto): Promise<number> {
        await this.refreshTokenIfNeeded();

        const contactData: ContactData = {
            name: contactDataDto.name,
            custom_fields_values: [
                {
                    field_id: CustomFields.email,
                    values: [
                        {
                            value: contactDataDto.email
                        }
                    ]
                },
                {
                    field_id: CustomFields.phone,
                    values: [
                        {
                            value: contactDataDto.phone
                        }
                    ]
                }
            ]
        };

        const existingContact = await this.getContactByPhone(contactDataDto.phone);

        if (existingContact) {
            const contactId = existingContact.id;
            const response = await fetch(`${this.amoApiUrl}api/v4/contacts/${contactId}`, {
                method: 'patch',
                body: JSON.stringify(contactData),
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.accessToken}`,
                }
            });
            await this.checkStatus(response);
            return contactId;
        } else {
            const response = await fetch(`${this.amoApiUrl}api/v4/contacts`, {
                method: 'post',
                body: JSON.stringify([contactData]),
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.accessToken}`,
                }
            });
            await this.checkStatus(response);
            const { _embedded: { contacts } } = await response.json() as ContactsResponse;
            return contacts[0]?.id || 0;
        }
    }

    async createLeadWithContact(contactId: number, leadData: object): Promise<string | object> {
        await this.refreshTokenIfNeeded();

        const leadWithContact = {
            ...leadData,
            _embedded: {
                contacts: [{
                    id: contactId,
                    is_main: true
                }]
            },
        };

        const response = await fetch(`${this.amoApiUrl}api/v4/leads`, {
            method: 'post',
            body: JSON.stringify([leadWithContact]),
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.accessToken}`,
            }
        });
        await this.checkStatus(response);
        let data: string | object;
        if (response.headers.get('content-type')?.includes('json')) {
            data = await response.json() as object;
        } else {
            data = await response.text();
        }
        return data;
    }

}
