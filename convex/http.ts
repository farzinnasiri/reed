import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { authComponent, createAuth } from './auth';
import { speechCorsResponse, transcribeSpeechHttp } from './speechHttp';

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, {
  cors: true,
});

http.route({
  handler: httpAction(async (ctx, request) => transcribeSpeechHttp(ctx, request)),
  method: 'POST',
  path: '/speech/transcribe',
});

http.route({
  handler: httpAction(async () => speechCorsResponse()),
  method: 'OPTIONS',
  path: '/speech/transcribe',
});

export default http;
