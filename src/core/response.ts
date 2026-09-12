import type { HttpResponseData } from './types.ts';

export class HttpResponseBuilder {
  private _status = 200;
  private _headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
  };

  public status(code: number): this {
    this._status = code;
    return this;
  }

  public header(name: string, value: string): this {
    this._headers[name.toLowerCase()] = value;
    return this;
  }

  public headers(headers: Record<string, string>): this {
    for (const [key, value] of Object.entries(headers)) {
      this._headers[key.toLowerCase()] = value;
    }
    return this;
  }

  public json<T>(body: T): HttpResponseData<T> {
    return {
      statusCode: this._status,
      headers: this._headers,
      body,
      isCustomResponse: true,
    };
  }
}

export const HttpResponse = {
  status(code: number): HttpResponseBuilder {
    return new HttpResponseBuilder().status(code);
  },

  json<T>(body: T, statusCode = 200, headers: Record<string, string> = {}): HttpResponseData<T> {
    return {
      statusCode,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        ...headers,
      },
      body,
      isCustomResponse: true,
    };
  },

  ok<T>(body: T, headers?: Record<string, string>): HttpResponseData<T> {
    return HttpResponse.json(body, 200, headers);
  },

  created<T>(body: T, headers?: Record<string, string>): HttpResponseData<T> {
    return HttpResponse.json(body, 201, headers);
  },

  noContent(headers?: Record<string, string>): HttpResponseData<null> {
    return {
      statusCode: 204,
      headers: headers ?? {},
      body: null,
      isCustomResponse: true,
    };
  },
};

export function isHttpResponseData(value: unknown): value is HttpResponseData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isCustomResponse' in value &&
    (value as any).isCustomResponse === true
  );
}
