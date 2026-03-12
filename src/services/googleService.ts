import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages.create'
];

const TOKEN_PATH = path.join(process.cwd(), 'google_tokens.json');

export class GoogleService {
  private _oauth2Client: OAuth2Client | null = null;

  private get oauth2Client(): OAuth2Client {
    if (!this._oauth2Client) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const appUrl = process.env.APP_URL?.replace(/\/$/, '');

      if (!clientId || !clientSecret || !appUrl) {
        console.warn("Missing Google OAuth credentials or APP_URL. Google integration may fail.");
        console.log("Current Config - ClientID:", !!clientId, "Secret:", !!clientSecret, "AppURL:", appUrl);
      }

      const redirectUri = `${appUrl}/auth/google/callback`;
      console.log("Initializing Google OAuth with Redirect URI:", redirectUri);

      this._oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
      );

      this.loadSavedTokens();
    }
    return this._oauth2Client;
  }

  constructor() {
    // Initialization is now lazy via the oauth2Client getter
  }

  private loadSavedTokens() {
    if (fs.existsSync(TOKEN_PATH)) {
      try {
        const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        this._oauth2Client?.setCredentials(tokens);
      } catch (e) {
        console.error("Failed to load tokens", e);
      }
    }
  }

  public getAuthUrl(state?: string) {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: state
    });
  }

  public async setTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    return tokens;
  }

  public isConnected() {
    return !!this.oauth2Client.credentials.access_token;
  }

  // Sheets Methods
  public async updateSheet(spreadsheetId: string, range: string, values: any[][]) {
    if (!this.isConnected()) throw new Error('Google Service not connected');
    const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  }

  public async appendRow(spreadsheetId: string, range: string, values: any[]) {
    if (!this.isConnected()) throw new Error('Google Service not connected');
    const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });
  }

  public async createSheet(title: string) {
    if (!this.isConnected()) throw new Error('Google Service not connected');
    const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
    const response = await sheets.spreadsheets.create({
      requestBody: { properties: { title } },
    });
    return response.data.spreadsheetId;
  }

  // Drive Methods
  public async listFiles() {
    if (!this.isConnected()) throw new Error('Google Service not connected');
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    const res = await drive.files.list({ pageSize: 10, fields: 'files(id, name)' });
    return res.data.files;
  }

  // Docs Methods
  public async createDoc(title: string, content: string) {
    if (!this.isConnected()) throw new Error('Google Service not connected');
    const docs = google.docs({ version: 'v1', auth: this.oauth2Client });
    const doc = await docs.documents.create({ requestBody: { title } });
    if (doc.data.documentId) {
      await docs.documents.batchUpdate({
        documentId: doc.data.documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content
              }
            }
          ]
        }
      });
    }
    return doc.data.documentId;
  }

  // Gmail Methods
  public async sendEmail(to: string, subject: string, body: string) {
    if (!this.isConnected()) throw new Error('Google Service not connected');
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      body,
    ];
    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });
  }

  // Chat Methods (Basic implementation)
  public async listChatSpaces() {
    if (!this.isConnected()) throw new Error('Google Service not connected');
    const chat = google.chat({ version: 'v1', auth: this.oauth2Client });
    const res = await chat.spaces.list();
    return res.data.spaces;
  }
}

export const googleService = new GoogleService();
