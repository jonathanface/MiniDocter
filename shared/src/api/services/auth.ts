import { AxiosInstance } from "axios";
import { UserDetails } from "../../types";

export class AuthService {
  constructor(private client: AxiosInstance) {}

  async getCurrentUser(): Promise<UserDetails> {
    const { data } = await this.client.get<UserDetails>("/user");
    return data;
  }

  async login(email: string, password: string): Promise<UserDetails> {
    const { data } = await this.client.post<UserDetails>("/auth/login", {
      email,
      password,
    });
    return data;
  }

  async signup(email: string, password: string, firstName?: string, lastName?: string): Promise<UserDetails> {
    const { data } = await this.client.post<UserDetails>("/auth/signup", {
      email,
      password,
      first_name: firstName,
      last_name: lastName,
    });
    return data;
  }

  async logout(): Promise<void> {
    await this.client.post("/auth/logout");
  }
}
