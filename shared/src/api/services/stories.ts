import { AxiosInstance } from "axios";
import { Story, Chapter } from "../../types";

export interface CreateStoryData {
  title: string;
  description?: string;
  series_id?: string;
  image_url?: string;
}

export interface UpdateStoryData {
  title?: string;
  description?: string;
  series_id?: string;
  image_url?: string;
  inactive?: boolean;
}

export class StoriesService {
  constructor(private client: AxiosInstance) {}

  async getStories(): Promise<Story[]> {
    const { data } = await this.client.get<Story[]>("/stories");
    return data;
  }

  async getStory(storyId: string): Promise<Story> {
    const { data } = await this.client.get<Story>(`/stories/${storyId}`);
    return data;
  }

  async createStory(storyData: CreateStoryData): Promise<Story> {
    const { data } = await this.client.post<Story>("/stories", storyData);
    return data;
  }

  async updateStory(storyId: string, storyData: UpdateStoryData): Promise<Story> {
    const { data } = await this.client.put<Story>(`/stories/${storyId}`, storyData);
    return data;
  }

  async deleteStory(storyId: string): Promise<void> {
    await this.client.delete(`/stories/${storyId}`);
  }

  async getChapters(storyId: string): Promise<Chapter[]> {
    const { data } = await this.client.get<Chapter[]>(`/stories/${storyId}/chapters`);
    return data;
  }

  async getChapter(storyId: string, chapterId: string): Promise<Chapter> {
    const { data } = await this.client.get<Chapter>(`/stories/${storyId}/chapters/${chapterId}`);
    return data;
  }
}
