import * as rt from "https://stupid-extensions.com/denopkg.com/Liamolucko/runtypes@export-type/src/index.ts";
import {
  ActionsError,
  ActionsPage,
  ActionsRevision,
  LegacyActionsError,
  QueryImage,
  QueryPages,
} from "./actions-types.ts";
import { AsyncPage } from "./page.ts";
import {
  ApiError,
  CompleteResult,
  Diff,
  FileWithThumbnail,
  Revision,
  RevisionWithPage,
  SearchResult,
} from "./rest-types.ts";
import { AsyncRevision } from "./revision.ts";

type AsyncProxy<T> = { [P in keyof T]: Promise<T[P]> } & Promise<T>;
function AsyncProxy<T>(target: Promise<T>): AsyncProxy<T> {
  return new Proxy(target, {
    get(target, prop: keyof T | keyof Promise<T>) {
      if (
        prop === "then" || prop === "catch" || prop === "finally" ||
        prop === Symbol.toStringTag
      ) {
        return target[prop as keyof typeof target];
      } else {
        return target.then((value) => value[prop]);
      }
    },
  }) as { [P in keyof T]: Promise<T[P]> } & Promise<T>;
}

function handleError<T>(
  response: T | ApiError | ActionsError | LegacyActionsError,
) {
  if (ApiError.guard(response)) {
    throw new Error(
      response.messageTranslations?.["en"] ??
        response.message ??
        response.httpCode.toString(),
    );
  } else if (ActionsError.guard(response)) {
    throw new Error(response.errors[0].text);
  } else if (LegacyActionsError.guard(response)) {
    throw new Error(response.error.info);
  } else {
    return response;
  }
}

/**
 * A wrapper object for a wiki at a given url.
 */
export class Wiki {
  apiUrl: URL;
  polyfilled: boolean;

  /**
   * Creates a wiki object from its API url
   * @param url The path to the wiki's API, e.g. `https://en.wikipedia.org/w/rest.php/v1/`.
   * @param token OAuth token to use for authentication
   */
  constructor(url: string | URL, public token?: string) {
    this.apiUrl = url instanceof URL ? url : new URL(url);

    if (this.apiUrl.pathname.endsWith("rest.php/v1")) {
      this.apiUrl.pathname += "/";
    } else if (this.apiUrl.pathname.endsWith("api.php/")) {
      this.apiUrl.pathname = this.apiUrl.pathname.slice(0, -1);
    }

    this.polyfilled = this.apiUrl.pathname.endsWith("api.php");
  }

  async convertRevision(revision: ActionsRevision): Promise<Revision>;
  async convertRevision(
    revision: ActionsRevision,
    page: ActionsPage,
  ): Promise<RevisionWithPage>;
  async convertRevision(
    revision: ActionsRevision,
    page?: { pageid: number; title: string },
  ): Promise<Revision | RevisionWithPage> {
    return {
      id: revision.revid,
      timestamp: revision.timestamp,
      minor: revision.minor,
      size: revision.size,
      comment: revision.comment,
      user: {
        id: revision.userid || null,
        name: revision.user,
      },
      delta: revision.parentid !== 0
        ? await this.request({
          params: {
            action: "query",
            revids: revision.parentid,
            prop: "revisions",
            rvprop: "size",
          },
        })
          .then(QueryPages.check)
          .then(({ query }) => revision.size - query.pages[0].revisions[0].size)
        : null,
      ...page && { page: { id: page.pageid, title: page.title } },
    };
  }

  /** 
   * Make a HTTP request to the API.
   */
  async request({ method = "GET", path = "", params = {}, headers, body }: {
    method?: string;
    path?: string;
    params?: Record<string, string | number | string[] | undefined>;
    headers?: Record<string, string>;
    body?: string;
  }) {
    return fetch(
      new URL(
        `${path}?${
          new URLSearchParams(
            Object.fromEntries(
              Object.entries(
                this.polyfilled
                  ? {
                    ...params,
                    format: "json",
                    formatversion: "2",
                    errorformat: "plaintext",
                  }
                  : params,
              )
                .filter((
                  param,
                ): param is [string, string | number | string[]] =>
                  typeof param[1] !== "undefined"
                )
                .map(([key, value]) => [
                  key,
                  typeof value === "string" ? value : typeof value === "number"
                    ? value.toString()
                    : value.join("|"),
                ]),
            ),
          ).toString()
        }`,
        this.apiUrl,
      ),
      {
        body,
        headers,
        method,
      },
    )
      .then((response) => response.json())
      .then(handleError);
  }

  // Polyfills

  /** WIP */
  private async searchPolyfill(
    q: string,
    limit: number | string = 50,
  ): Promise<{ pages: SearchResult[] }> {
    return this.request({
      params: {
        action: "query",
        list: "search",
        srsearch: q,
        srlimit: limit,
      },
    });
  }

  private async filePolyfill(
    title: string,
    thumbnails = true,
    thumbsize = 1000000,
  ) {
    const page = await this.request({
      params: {
        action: "query",
        titles: title,
        prop: ["imageinfo", "pageimages"],
        iiprop: [
          "timestamp",
          "user",
          "userid",
          "size",
          "url",
          "mediatype",
        ],
        piprop: ["thumbnail", "name", "original"],
        pithumbsize: thumbsize,
      },
    }).then(QueryImage.check)
      .then(({ query }) => query.pages[0]);

    const imageInfo = page.imageinfo[0];

    const original = {
      mediatype: imageInfo.mediatype,
      size: imageInfo.size,
      width: imageInfo.width || null, // In this case I specifically want 0 to become null
      height: imageInfo.height || null,
      duration: imageInfo.duration ?? null,
      url: (page.original?.source ?? imageInfo.url).split(/:(?=\/\/)/)[1],
    };

    return {
      title: (imageInfo.canonicaltitle ?? page.title).split(/File:/)[1],
      file_description_url: imageInfo.descriptionurl.split(/:(?=\/\/)/)[1],
      latest: {
        timestamp: imageInfo.timestamp,
        user: { id: imageInfo.userid, name: imageInfo.user },
      },

      // TODO: I couldn't figure out how to get this, so I'm just copying the original for now
      preferred: original,

      original,

      ...(thumbnails && {
        thumbnail: typeof page.thumbnail !== "undefined"
          ? {
            ...original,
            url: page.thumbnail.source.split(/:(?=\/\/)/)[1],
            ...(original.width !== null &&
              { width: page.thumbnail.width, height: page.thumbnail.height }),
          }
          : original,
      }),
    };
  }

  /**
   * Searches wiki page titles and contents for the provided search terms, and returns matching pages.
   * @param q Search terms
   * @param limit Maximum number of search results to return, between 1 and 100. Default: 50
   */
  async search(
    q: string,
    limit: number = 50,
  ): Promise<SearchResult[]> {
    if (limit < 1 || limit > 100) {
      throw Error(
        "Invalid limit requested. Set limit parameter to between 1 and 100.",
      );
    }

    if (this.polyfilled) {
      throw new Error("TODO");
    } else {
      return this.request({
        path: "search/page",
        params: { q, limit },
      }).then(({ pages }) => rt.Array(SearchResult).check(pages));
    }
  }

  /** 
   * Searches wiki page titles, and returns matches between the beginning of a title and the provided search terms. You can use this endpoint for a typeahead search that automatically suggests relevant pages by title.
   * @param q Search terms
   * @param limit Maximum number of search results to return, between 1 and 100. Default: 50
   */
  async complete(
    q: string,
    limit: number = 50,
  ): Promise<CompleteResult[]> {
    if (limit < 1 || limit > 100) {
      throw Error(
        "Invalid limit requested. Set limit parameter to between 1 and 100.",
      );
    }

    return this.request({
      path: "search/title",
      params: { q, limit },
    }).then(({ pages }) => rt.Array(CompleteResult).check(pages));
  }

  /**
   * Returns a `Page` object with the given key.
   * 
   * You can access any of its properties through async property accessors or by calling fetch() which returns an object with all of its computed properties.
   * 
   * @param title The title of the page.
   * 
   * ```typescript
   * console.log(await page.title)
   *
   * // OR
   *
   * let data = await page.fetch()
   * console.log(data.title)
   * ```
   */
  page(title: string) {
    return new AsyncPage(this, title);
  }

  /**
   * Returns information about a file, including links to download the file in thumbnail, preview, and original formats.
   * @param title File title
   */
  async file(title: string) {
    return AsyncProxy(
      this.request({ path: `file/${title}` }).then(FileWithThumbnail.check),
    );
  }

  /** 
   * Returns details for an individual revision.
   * 
   * It can also be chained for the effect of `compare`:
   * ```typescript
   * await wiki.revision(42).compare(43)
   * // Is equivalent to
   * await wiki.compare(42, 43)
   * ```
   */
  revision(id: number) {
    return new AsyncRevision(this, id);
  }

  /** 
   * Returns data that lets you display a line-by-line comparison of two revisions. (See [an example](https://en.wikipedia.beta.wmflabs.org/w/index.php?diff=388864&oldid=388863&title=Main_Page&type=revision).) Only text-based wiki pages can be compared. 
   * @param from Revision identifier to use as the base for comparison
   * @param to Revision identifier to compare to the base
   */
  async compare(from: number | string, to: number | string): Promise<Diff> {
    return this.request({ path: `revision/${from}/compare/${to}` }).then(
      Diff.check,
    );
  }
}

export default Wiki;
