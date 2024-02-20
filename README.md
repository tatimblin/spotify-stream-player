# spotify-stream-player

## Deploy Service

1. `gcloud run deploy spot-fy-stream-player --source`
2. Region: [34] us-east4

## Get Refresh Token
1. Sign-in using browser
```
https://accounts.spotify.com/authorize?client_id=<client_id>&response_type=code&redirect_uri=http%3A%2F%2Flocalhost:3000&scope=user-read-currently-playing%20user-top-read
```
2. Request refresh token
```
curl -H "Authorization: Basic <base64 encoded client_id:client_secret>" -d grant_type=authorization_code -d code=<code> -d redirect_uri=http%3A%2F%2Flocalhost:3000 https://accounts.spotify.com/api/token
```