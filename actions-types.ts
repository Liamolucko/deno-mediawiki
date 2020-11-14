// This is not a comprehensive list, just what I needed to polyfill the REST API.
// Also, they're all shown as being required even through most aren't.

import {
  Array,
  Boolean,
  Number,
  Partial,
  Record,
  Static,
  String,
} from "https://stupid-extensions.com/denopkg.com/Liamolucko/runtypes@export-type/src/index.ts";

export const LegacyActionsError = Record({
  error: Record({
    code: String,
    info: String,
    docref: String,
  }),
});
export type LegacyActionsError = Static<typeof LegacyActionsError>;

export const ActionsError = Record({
  errors: Array(Record({
    code: String,
    text: String,
    module: String,
  })),
  docref: String,
  servedby: String,
});
export type ActionsError = Static<typeof ActionsError>;

export const ActionsRevision = Record({
  revid: Number,
  parentid: Number,
  minor: Boolean,
  user: String,
  userid: Number,
  timestamp: String,
  size: Number,
  comment: String,
  tags: Array(String),
}).And(Partial({
  anon: Boolean,
}));
export type ActionsRevision = Static<typeof ActionsRevision>;

export const ActionsRevisionWithContent = Record({
  revid: Number,
  timestamp: String,
  content: String,
});
export type ActionsRevisionWithContent = Static<
  typeof ActionsRevisionWithContent
>;

export const ActionsPage = Record({
  pageid: Number,
  title: String,
});
export type ActionsPage = Static<typeof ActionsPage>;

export const ActionsPageWithContent = ActionsPage.And(Record({
  revisions: Array(ActionsRevisionWithContent),
  contentmodel: String,
}));
export type ActionsPageWithContent = Static<typeof ActionsPageWithContent>;

export const ActionsPageWithImages = ActionsPage.And(Record({
  images: Array(Record({ title: String })),
  imageinfo: Array(
    Record({
      canonicaltitle: String,
      timestamp: String,
      user: String,
      userid: Number,
      size: Number,
      width: Number,
      height: Number,
      url: String,
      descriptionurl: String,
      mediatype: String,
    }).And(Partial({
      duration: Number,
    })),
  ),
  thumbnail: Record({ source: String, width: Number, height: Number }),
  original: Record({ source: String, width: Number, height: Number }),
  pageimage: String,
}));
export type ActionsPageWithImages = Static<typeof ActionsPageWithImages>;

export const ActionsPageWithRevisions = ActionsPage.And(Record({
  revisions: Array(ActionsRevision),
}));
export type ActionsPageWithRevisions = Static<typeof ActionsPageWithRevisions>;

export const ActionsPageWithContributors = Record({
  contributors: Array(Record({ userid: Number, name: String })),
  revisions: Array(ActionsRevision),
});
export type ActionsPageWithContributors = Static<typeof ActionsPageWithContributors>;

export const QueryPageResponse = Record({
  query: Record({
    pages: Array(ActionsPageWithContent),
    rightsinfo: Record({
      url: String,
      text: String,
    }),
  }),
});
export type QueryPageResponse = Static<typeof QueryPageResponse>;

export const QueryImagesResponse = Record({
  query: Record({
    pages: Array(ActionsPageWithImages),
  }),
});
export type QueryImagesResponse = Static<typeof QueryImagesResponse>;

export const QueryHistoryResponse = Record({
  query: Record({
    pages: Array(ActionsPageWithContributors),
  }),
  continue: Record({
    rvcontinue: String,
  }),
});
export type QueryHistoryResponse = Static<typeof QueryHistoryResponse>;

export const QueryRevisionResponse = Record({
  query: Record({
    pages: Array(ActionsPageWithRevisions),
  }),
});
export type QueryRevisionResponse = Static<typeof QueryRevisionResponse>;

export const QueryRevisionSizeResponse = Record({
  query: Record({
    pages: Array(Record({
      revisions: Array(Record({
        size: Number,
      })),
    })),
  }),
});
export type QueryRevisionSizeResponse = Static<typeof QueryRevisionSizeResponse>;

export const ParseHtmlResponse = Record({
  parse: Record({
    text: String,
  }),
});
export type ParseHtmlResponse = Static<typeof ParseHtmlResponse>;

export const ParseLanglinksResponse = Record({
  parse: Record({
    langlinks: Array(Record({
      lang: String,
      autonym: String,
      title: String,
    })),
  }),
});
export type ParseLanglinksResponse = Static<typeof ParseLanglinksResponse>;
