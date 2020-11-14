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
  content: String,
  size: Number,
  comment: String,
  tags: Array(String),
}).And(Partial({
  anon: Boolean,
}));
export type ActionsRevision = Static<typeof ActionsRevision>;

export const ActionsPage = Record({
  pageid: Number,
  title: String,
  revisions: Array(ActionsRevision),
  contentmodel: String,
});
export type ActionsPage = Static<typeof ActionsPage>;

export const ImagePage = Record({
  title: String,
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
});
export type ImagePage = Static<typeof ImagePage>;

export const ContributorPage = Record({
  contributors: Array(Record({ userid: Number, name: String })),
  revisions: Array(ActionsRevision),
})
export type ContributorPage = Static<typeof ContributorPage>;

export const QueryPages = Record({
  query: Record({
    pages: Array(ActionsPage),
    rightsinfo: Record({
      url: String,
      text: String,
    }),
    users: Array(Partial({ groups: Array(String), invalid: Boolean })),
  }),
});
export type QueryPages = Static<typeof QueryPages>;

export const QueryImage = Record({
  query: Record({
    pages: Array(ImagePage),
  }),
});
export type QueryImage = Static<typeof QueryImage>;

export const QueryRevisions = Record({
  query: Record({
    pages: Array(ContributorPage)
  }),
  continue: Record({
    rvcontinue: String,
  }),
})
export type QueryRevisions = Static<typeof QueryRevisions>;

export const ParseText = Record({
  parse: Record({
    text: String,
  }),
});
export type ParseText = Static<typeof ParseText>;

export const ParseLanglinks = Record({
  parse: Record({
    langlinks: Array(Record({
      lang: String,
      autonym: String,
      title: String,
    })),
  }),
});
export type ParseLanglinks = Static<typeof ParseLanglinks>;
