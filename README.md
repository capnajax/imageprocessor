# Image Processor

This component creates thumbnail images and prepare them for loading into the database.

This is intended to run in a separate pod with many replicas. Each job is atomic so many of these pods can run in parallel.

The Image Store is the controller for this application. It feeds the jobs.

## Endpoints

### `GET /healthz`

This is a simple health check end point for Kubernetes monitoring.

### `POST /job`

Accepts a job, processes it, and returns information for loading into the database.

#### request body

```json
{ "pathname": "<path of the original image>",
  "commands": [
    { "filename": "<name of the new image>",
      "width": 640, // optional
      "height": 480, // optional
      "transform": { // optional
        "flip" : "x", // "x" or "y". optional
        "rotate" : 90 // degrees, optional
        // flips are performed before rotations
      }
    }
  ]
}
```

#### response body

```json
{ "uuid": "<a uuid string>",
  "outputDir": "<the dir where the transformed images landed>",
  "log": "<a file that containes all the logs for that image transform task"
}
```

### return stati

* `200` -- successfully ran all the commands and placed the new files in the returned `outputDir` name.
* `204` -- requests with no commands get an empty response
* `400` -- errors occured while processing image
* `404` -- unknown path
* `405` -- wrong HTTP verb
