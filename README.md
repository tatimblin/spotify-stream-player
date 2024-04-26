# spotify-stream-player

This project is an implementation of a read-only music player similar to the one on your phones lockscreen. It has two parts:

1. Streaming Server: The Spotify Rest API does not have support for event-based data detection. This server sits in between the Spotify and the client, it polls the Spotify API and detects changes to send to the client.
2. Custom Element: The front-end is a small dependency free custom HTML element. This allows for good portability by not tying it into any particular framework.

[Tweet](https://x.com/tatimblin/status/1777873720754967010)

## Getting Started

You can deploy the SSE server wherever you like. I chose Google Cloud Run because it supports Server Sent Events, can handle 250 connections on one instance, and is short lived (15min). This suits my needs well of providing a non-critical feature that will be largely be idle.

### Deploy Server

```
gcloud run deploy spotify-stream-player --region us-east4 --source ./server
```

#### Spotify Authentication

I found Spotify to not have a great out of the box authentication solution for this particular use case. Understandably they are focused on supporting third-party sign-on where each user uses their own account. To obtain long-lived credentials for a particular account you can generate a refresh token (which doesn't expire), the SSE server then immediately uses that to generate a fresh access token.

1. Register a Spotify API app

[https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)

Set the Redirect URI to: `http://localhost:3000`

2. Get your Client ID:

On [spotify.com](https://open.spotify.com/) visit your profile and copy the ID from the address bar.

3. Sign-in using a browser

Visit the following page in your browser.
```
https://accounts.spotify.com/authorize?client_id=<CLIENT_ID>&response_type=code&redirect_uri=http%3A%2F%2Flocalhost:3000&scope=user-read-currently-playing%20user-top-read
```

You should receieve a secret token

4. Encode your token

Use a [base64 encoding website](https://www.base64encode.org/) to generate your encryption certificate. Use this format `<CLIENT_ID>:<CLIENT_SECRET>`.

5. Obtain long-lived Refresh Token

In your terminal, run:
```
curl -H "Authorization: Basic <BASE64_CERTIFICATE>" -d grant_type=authorization_code -d code=<code> -d redirect_uri=http%3A%2F%2Flocalhost:3000 https://accounts.spotify.com/api/token
```

#### Configuration

The server takes several environment variables for configuration.

* PORT: The port to serve on. i.e. `8080`
* ORIGINS: comma-separated list of allowed origins. i.e. `https://tristantimblin.dev,localhost:5173`
* SPOTIFY_ID
* SPOTIFY_SECRET
* SPOTIFY_REFRESH

### Client Installation

(wip)
The client can be installed from npm `@tristimb/spotify-stream-player` or by downloading this repo and making your own build `npm run build` and importing it directly in your HTML. As long as the bundle runs the Custom Element will be registered on the DOM and can be used like `<spotify-player src="http://localhost:8080/" />`.
