import { AxiosInstance } from "axios";
import { createApiClient, ApiClientConfig } from "./client";
import { AuthService } from "./services/auth";
import { StoriesService } from "./services/stories";
import { AssociationsService } from "./services/associations";

export class DocterApi {
  public auth: AuthService;
  public stories: StoriesService;
  public associations: AssociationsService;

  private client: AxiosInstance;

  constructor(config: ApiClientConfig) {
    this.client = createApiClient(config);
    this.auth = new AuthService(this.client);
    this.stories = new StoriesService(this.client);
    this.associations = new AssociationsService(this.client);
  }

  /**
   * Get the underlying Axios instance for custom requests
   */
  getClient(): AxiosInstance {
    return this.client;
  }
}

export * from "./client";
export * from "./services/auth";
export * from "./services/stories";
export * from "./services/associations";
