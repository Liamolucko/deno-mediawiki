// This is not a comprehensive list, just what I needed to polyfill the REST API.
// Also, they're all shown as being required even through most aren't.

export interface LegacyActionsError {
  error: {
    code: string;
    info: string;
    docref: string;
  };
}

export interface ActionsError {
  errors: Array<{
    code: string;
    text: string;
    module: string;
  }>;
  docref: string;
  servedby: string;
}

export interface ActionsRevision {
  revid: number;
  parentid: number;
  minor: boolean;
  user: string;
  anon?: boolean;
  userid: number;
  timestamp: string;
  size: number;
  comment: string;
  tags: string[];
}

export interface ActionsPage {
  pageid: number;
  title: string;
  revisions: Array<ActionsRevision>;
  contentmodel: string;
  images: Array<{ title: string }>;
  imageinfo: Array<{
    canonicaltitle: string;
    timestamp: string;
    user: string;
    userid: number;
    size: number;
    width: number;
    height: number;
    duration?: number;
    url: string;
    descriptionurl: string;
    mediatype: string;
  }>;
  thumbnail: { source: string; width: number; height: number };
  original: { source: string; width: number; height: number };
  pageimage: string;
  contributors: Array<{ userid: number; name: string }>;
}

export interface QueryResponse {
  query: {
    pages: Array<ActionsPage>;
    rightsinfo: {
      url: string;
      text: string;
    };
    users: Array<{ groups?: string[]; invalid?: boolean }>;
  };
  continue: {
    rvcontinue: string;
  };
  search: Array<{
    title: string;
    pageid: number;
    snippet: string;
  }>;
}

export interface ParseResponse {
  parse: {
    pageid: number;
    title: string;
    wikitext: string;
    text: string;
    langlinks: Array<{
      lang: string;
      autonym: string;
      title: string;
    }>;
  };
}
