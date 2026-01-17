export interface IMovie {
  id: string;
  name: string;
  image: string;
  description: string;
}

export interface IInterest {
  id: string;
  name: string;
  primaryImage: {
    url: string;
    width: number;
    height: number;
  };
  description: string;
}

export interface ICategory {
  category?: string;
  interests: IInterest[];
}

export interface IResponse {
  categories: ICategory[];
}

export type TPage = 'home' | 'search' | 'favorite';
