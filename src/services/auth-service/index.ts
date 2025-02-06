import bcrypt from "bcrypt";
import { IDatabaseService } from "../database-service";

export class AuthService {
  private readonly databaseService: IDatabaseService;

  constructor(dbService: IDatabaseService) {
    this.databaseService = dbService;
  }

  async initialize(): Promise<void> {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) return;
    await this.addUser(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);
  }

  async addUser(username: string, password: string): Promise<void> {
    const salt = await bcrypt.genSalt(10);
    const dbData = this.databaseService.getData();
    dbData.auth[username] = {
      passwordHash: await bcrypt.hash(password, salt),
    };

    await this.databaseService.save(dbData);
  }

  async authenticate(authHeader: string): Promise<boolean> {
    const [method, credentials] = authHeader.split(" ");
    if (method !== "Basic") return false;

    const [username, password] = Buffer.from(credentials, "base64")
      .toString()
      .split(":");

    const user = this.databaseService.getData().auth[username];
    if (!user) return false;

    return bcrypt.compare(password, user.passwordHash);
  }
}
