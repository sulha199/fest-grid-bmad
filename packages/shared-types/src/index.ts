export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface Event {
  id: string;
  eventName: string;
  performers?: string[];
  location?: string;
  types?: string[];
  categories?: string[];
  date: string;
}
