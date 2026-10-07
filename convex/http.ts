import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { controlPanelCorsResponse, controlPanelHttp } from './controlPanelHttp';
import { speechCorsResponse, transcribeSpeechHttp } from './speechHttp';

const http = httpRouter();

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

http.route({
  handler: httpAction(async (ctx, request) => controlPanelHttp(ctx, request)),
  method: 'POST',
  path: '/control-panel',
});

http.route({
  handler: httpAction(async () => controlPanelCorsResponse()),
  method: 'OPTIONS',
  path: '/control-panel',
});

export default http;
