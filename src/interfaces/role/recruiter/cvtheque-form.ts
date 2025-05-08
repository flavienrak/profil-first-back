export interface AddCvThequeCritereInterface {
  position: string;
  description?: string;
  domain: string;
  competences?: string[];
  experience?: number;
  diplome?: string;
  localisation?: string;
  distance?: number;
}

export interface UpdateCvThequeCritereInterface {
  position?: string;
  description?: string;
  domain?: string;
  competences?: string[];
  experience?: number;
  diplome?: string;
  localisation?: string;
  distance?: number;
}
