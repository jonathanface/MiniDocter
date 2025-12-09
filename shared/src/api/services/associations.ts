import { AxiosInstance } from "axios";
import { Association, AssociationDetails } from "../../types";

export interface CreateAssociationData {
  association_name: string;
  association_type: string;
  short_description?: string;
  portrait?: string;
  aliases?: string;
  case_sensitive?: boolean;
  details?: AssociationDetails;
}

export interface UpdateAssociationData {
  association_name?: string;
  association_type?: string;
  short_description?: string;
  portrait?: string;
  aliases?: string;
  case_sensitive?: boolean;
  details?: AssociationDetails;
}

export class AssociationsService {
  constructor(private client: AxiosInstance) {}

  async getAssociations(storyId: string): Promise<Association[]> {
    const { data } = await this.client.get<Association[]>(
      `/stories/${storyId}/associations`
    );
    return data;
  }

  async getAssociation(storyId: string, associationId: string): Promise<Association> {
    const { data } = await this.client.get<Association>(
      `/stories/${storyId}/associations/${associationId}`
    );
    return data;
  }

  async createAssociation(
    storyId: string,
    associationData: CreateAssociationData
  ): Promise<Association> {
    const { data } = await this.client.post<Association>(
      `/stories/${storyId}/associations`,
      associationData
    );
    return data;
  }

  async updateAssociation(
    storyId: string,
    associationId: string,
    associationData: UpdateAssociationData
  ): Promise<Association> {
    const { data } = await this.client.put<Association>(
      `/stories/${storyId}/associations/${associationId}`,
      associationData
    );
    return data;
  }

  async deleteAssociation(storyId: string, associationId: string): Promise<void> {
    await this.client.delete(`/stories/${storyId}/associations/${associationId}`);
  }
}
