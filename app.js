const express = require('express')
const app = express()
const querystring = require('querystring')
const http = require('http')

const retrieve = function(options, postData) {
  // return new pending promise
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
        resolve(chunk);
      });
      res.on('end', () => {
        console.log('No more data in response.');
      });
    });

    req.on('error', (e) => {
      reject(e);
      console.error(`problem with request: ${e.message}`);
    });

    // write data to request body
    req.write(postData);
    req.end();


  });
}



const example = {
  "@context": ["http://www.w3.org/ns/hydra/context.jsonld", {
    "Organization": "http://example.org/Organization",
    "hydra": "http://www.w3.org/ns/hydra/core#",
    "vocab": "http://localhost:3000/oslo-api/apiDocumentation#",
    "name": "http://schema.org/name",
    "description": "http://schema.org/description",
    "start_date": {
      "@id": "http://schema.org/startDate",
      "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
    },
    "end_date": {
      "@id": "http://schema.org/endDate",
      "@type": "http://www.w3.org/2001/XMLSchema#dateTime"
    }
  }],
  "@id": "/org/1",
  // "@type": "http://example.org/Organization",
  "@type": "Organization",
  "title": "An exemplary organization representation",
  "description": "This org can be deleted with an HTTP DELETE request"
};

const apiDocumentation = {
  "@context": {
    "vocab": "http://localhost:3000/oslo-api/apiDocumentation#",
    "hydra": "http://www.w3.org/ns/hydra/core#",
    "ApiDocumentation": "hydra:ApiDocumentation",
    "property": {
      "@id": "hydra:property",
      "@type": "@id"
    },
    "readonly": "hydra:readonly",
    "writeonly": "hydra:writeonly",
    "supportedClass": "hydra:supportedClass",
    "supportedProperty": "hydra:supportedProperty",
    "supportedOperation": "hydra:supportedOperation",
    "method": "hydra:method",
    "expects": {
      "@id": "hydra:expects",
      "@type": "@id"
    },
    "returns": {
      "@id": "hydra:returns",
      "@type": "@id"
    },
    "statusCodes": "hydra:statusCodes",
    "code": "hydra:statusCode",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "label": "rdfs:label",
    "description": "rdfs:comment",
    "domain": {
      "@id": "rdfs:domain",
      "@type": "@id"
    },
    "range": {
      "@id": "rdfs:range",
      "@type": "@id"
    },
    "subClassOf": {
      "@id": "rdfs:subClassOf",
      "@type": "@id"
    }
  },
  "@id": "http://localhost:3000/apiDocumentation",
  "@type": "ApiDocumentation",
  "supportedClass": [
    {
      "@id": "http://www.w3.org/ns/hydra/core#Collection",
      "@type": "hydra:Class",
      "hydra:title": "Collection",
      "hydra:description": null,
      "supportedOperation": [],
      "supportedProperty": [
        {
          "property": "http://www.w3.org/ns/hydra/core#member",
          "hydra:title": "members",
          "hydra:description": "The members of this collection.",
          "required": null,
          "readonly": false,
          "writeonly": false
        }
      ]
    },
    {
      "@id": "http://www.w3.org/ns/hydra/core#Resource",
      "@type": "hydra:Class",
      "hydra:title": "Resource",
      "hydra:description": null,
      "supportedOperation": [],
      "supportedProperty": []
    },
    {
      "@id": "http://www.w3.org/ns/org#Organization",
      "@type": "hydra:Class",
      "hydra:title": "Organization",
      "hydra:description": null,
      "supportedOperation": [
        {
          "@id": "_:Organization_replace",
          "@type": "http://schema.org/UpdateAction",
          "method": "PUT",
          "label": "Replaces an existing Organization entity",
          "description": null,
          "expects": "http://www.w3.org/ns/org#Organization",
          "returns": "http://www.w3.org/ns/org#Organization",
          "statusCodes": [
            {
              "code": 404,
              "description": "If the Organization entity wasn't found."
            }
          ]
        },
        {
          "@id": "_:Organization_delete",
          "@type": "http://schema.org/DeleteAction",
          "method": "DELETE",
          "label": "Deletes a Organization entity",
          "description": null,
          "expects": null,
          "returns": "http://www.w3.org/2002/07/owl#Nothing",
          "statusCodes": []
        },
        {
          "@id": "_:Organization_retrieve",
          "@type": "hydra:Operation",
          "method": "GET",
          "label": "Retrieves a Organization entity",
          "description": null,
          "expects": null,
          "returns": "http://www.w3.org/ns/org#Organization",
          "statusCodes": []
        }
      ],
      "supportedProperty": [
        {
          "property": "http://schema.org/name",
          "hydra:title": "name",
          "hydra:description": "The Organization's name",
          "required": true,
          "readonly": false,
          "writeonly": false
        },
        {
          "property": "http://schema.org/description",
          "hydra:title": "description",
          "hydra:description": "Description of the Organization",
          "required": true,
          "readonly": false,
          "writeonly": false
        },
        {
          "property": "http://schema.org/startDate",
          "hydra:title": "start_date",
          "hydra:description": "The start date and time of the Organization in ISO 8601 date format",
          "required": true,
          "readonly": false,
          "writeonly": false
        },
        {
          "property": "http://schema.org/endDate",
          "hydra:title": "end_date",
          "hydra:description": "The end date and time of the Organization in ISO 8601 date format",
          "required": true,
          "readonly": false,
          "writeonly": false
        }
      ]
    },
    {
      "@id": "vocab:EntryPoint",
      "@type": "hydra:Class",
      "subClassOf": null,
      "label": "EntryPoint",
      "description": "The main entry point or homepage of the API.",
      "supportedOperation": [
        {
          "@id": "_:entry_point",
          "@type": "hydra:Operation",
          "method": "GET",
          "label": "The APIs main entry point.",
          "description": null,
          "expects": null,
          "returns": "vocab:EntryPoint",
          "statusCodes": []
        }
      ],
      "supportedProperty": [
        {
          "property": {
            "@id": "vocab:EntryPoint/organizations",
            "@type": "hydra:Link",
            "label": "Organizations",
            "description": "The Organizations collection",
            "domain": "vocab:EntryPoint",
            "range": "vocab:OrganizationCollection",
            "supportedOperation": [
              {
                "@id": "_:Organization_collection_retrieve",
                "@type": "hydra:Operation",
                "method": "GET",
                "label": "Retrieves all Organization entities",
                "description": null,
                "expects": null,
                "returns": "vocab:OrganizationCollection",
                "statusCodes": []
              }
            ]
          },
          "hydra:title": "Organizations",
          "hydra:description": "The Organizations collection",
          "required": null,
          "readonly": true,
          "writeonly": false
        }
      ]
    },
    {
      "@id": "vocab:OrganizationCollection",
      "@type": "hydra:Class",
      "subClassOf": "http://www.w3.org/ns/hydra/core#Collection",
      "label": "OrganizationCollection",
      "description": "A collection of Organizations",
      "supportedOperation": [
        {
          "@id": "_:Organization_create",
          "@type": "http://schema.org/AddAction",
          "method": "POST",
          "label": "Creates a new Organization entity",
          "description": null,
          "expects": "http://www.w3.org/ns/org#Organization",
          "returns": "http://www.w3.org/ns/org#Organization",
          "statusCodes": [
            {
              "code": 201,
              "description": "If the Organization entity was created successfully."
            }
          ]
        },
        {
          "@id": "_:Organization_collection_retrieve",
          "@type": "hydra:Operation",
          "method": "GET",
          "label": "Retrieves all Organization entities",
          "description": null,
          "expects": null,
          "returns": "vocab:OrganizationCollection",
          "statusCodes": []
        }
      ],
      "supportedProperty": [
        {
          "property": "http://www.w3.org/ns/hydra/core#member",
          "hydra:title": "members",
          "hydra:description": "The Organizations",
          "required": null,
          "readonly": false,
          "writeonly": false
        }
      ]
    }
  ]
};

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Content-Type", "application/ld+json");
  res.set('Link', '<http://localhost:3000/apiDocumentation>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation"');

  next();
});

app.get('/', (req, res) => {
  res.redirect('/oslo-api');
});

app.get('/oslo-api', (req, res) => {
  const doc = {
    "@context": {
      "hydra": "http://www.w3.org/ns/hydra/core#",
      "vocab": "http://localhost:3000/oslo-api/apiDocumentation#",
      "EntryPoint": "vocab:EntryPoint",
      "organizations": {
        "@id": "vocab:EntryPoint/organizations",
        "@type": "@id"
      }
    },
    "@id": "/oslo-api",
    "@type": "EntryPoint",
    "organizations": "/oslo-api/organizations"
  };

  res.send(doc);
});

app.get('/oslo-api/org/1', (req, res) => {
  res.send(example);
});

app.get('/oslo-api/organizations', (req, res) => {
  const organizations = [];


  const postData = querystring.stringify({
    'query': `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                SELECT * WHERE {
                  ?s ?p ?o
                }
                LIMIT 10`
  });

  const options = {
    hostname: 'data.vlaanderen.be',
    port: 80,
    path: '/sparql',
    method: 'POST',
    headers: {
      'Accept': 'text/turtle'
      // 'Content-Length': Buffer.byteLength(postData)
    }
  };


  // send SPARQL request
  retrieve(options, postData).then(function(response) {
    debugger;
    console.log("Success!", response);
  }, function(error) {
    console.error("Failed!", error);
  })


  const doc = {
    "@context": {
      "hydra": "http://www.w3.org/ns/hydra/core#",
      "vocab": "http://localhost:3000/oslo-api/apiDocumentation#",
      "OrganizationCollection": "vocab:OrganizationCollection",
      "members": "http://www.w3.org/ns/hydra/core#member"
    },
    "@id": "/oslo-api/organizations/",
    "@type": "OrganizationCollection",
    "members": [
      {
        "@id": "/oslo-api/org/131",
        "@type": "http://www.w3.org/ns/org#Organization"
      }
    ]
  };

  res.send(doc);
});

app.get('/apiDocumentation', (req, res) => {
  res.send(apiDocumentation);
});

app.listen(3000, () => console.log('Example app listening on port 3000!'))