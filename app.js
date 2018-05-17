const express = require('express')
const app = express()
const SPARQL = require('sparql-client-2').SPARQL;
const sparql = new (require('sparql-client-2').SparqlClient)('http://data.vlaanderen.be/sparql');

const PAGE_SIZE = 10;

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

app.get('/oslo-api/organizations/:id', async (req, res) => {
  const orgId = req.params.id;

  const response = await sparql.query(`
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT * WHERE {
      OPTIONAL { <${orgId}> rdfs:seeAlso ?seeAlso. } .
      OPTIONAL { <${orgId}> <http://mu.semte.ch/vocabularies/core/uuid> ?uuid. } .
      OPTIONAL { <${orgId}> <http://www.w3.org/2004/02/skos/core#prefLabel> ?label. } .
      OPTIONAL { <${orgId}> <http://www.w3.org/ns/regorg#orgStatus> ?status. } .
      OPTIONAL { <${orgId}> <http://www.w3.org/ns/org#classification> ?classification. } .
      OPTIONAL { <${orgId}> <http://www.w3.org/2004/02/skos/core#altLabel> ?altLabel. } .
      OPTIONAL { <${orgId}> <http://www.w3.org/ns/org#identifier> ?identifier }
    }`).execute();

  if (!response.results.bindings.length) {
    return res.error(404);
  }

  const bindings = {};
  for (key of Object.keys(response.results.bindings[0])) {
    bindings[key] = response.results.bindings[0][key].value;
  }

  const doc = {
    "@context": ["http://www.w3.org/ns/hydra/context.jsonld", {
      "Organization": "http://example.org/Organization",
      "hydra": "http://www.w3.org/ns/hydra/core#",
      "vocab": "http://localhost:3000/oslo-api/apiDocumentation#",
      "name": "http://schema.org/name",
      "description": "http://schema.org/description",
      "seeAlso": {
        "@id": "rdfs:seeAlso",
        "@type": "@id"
      },
      "uuid": "http://mu.semte.ch/vocabularies/core/uuid",
      "label": "http://www.w3.org/2004/02/skos/core#prefLabel",
      "status": {
        "@id": "http://www.w3.org/ns/regorg#orgStatus",
        "@type": "@id"
      },
      "altLabel": "http://www.w3.org/2004/02/skos/core#altLabel",
      "identifier": "http://www.w3.org/ns/org#identifier",
    }],
    "@id": `/oslo-api/organizations/${encodeURIComponent(orgId)}`,
    "@type": "Organization",
    ...bindings
  };

  res.send(doc);
});

app.get('/oslo-api/organizations/', async (req, res) => {
  let page = req.query.page;
  if (!page) {
    return res.redirect('/oslo-api/organizations/?page=0');
  }
  page = parseInt(page, 10);
  const offset = page * PAGE_SIZE;
  const response = await sparql.query(SPARQL`
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?org WHERE {
      ?org a <http://www.w3.org/ns/org#Organization>
    }
    OFFSET ${offset}
    LIMIT ${PAGE_SIZE}`).execute();

  const organizations = response.results.bindings.map((binding) => ({
    "@id": "/oslo-api/organizations/" + encodeURIComponent(binding.org.value),
    "@type": "http://www.w3.org/ns/org#Organization"
  }));

  const doc = {
    "@context": {
      "hydra": "http://www.w3.org/ns/hydra/core#",
      "vocab": "http://localhost:3000/oslo-api/apiDocumentation#",
      "OrganizationCollection": "vocab:OrganizationCollection",
      "PagedCollection": "hydra:PagedCollection",
      "members": "http://www.w3.org/ns/hydra/core#member"
    },
    "@id": "/oslo-api/organizations/",
    "@type": "OrganizationCollection",
    "firstPage": "/oslo-api/organizations?page=0",
    "nextPage": "/oslo-api/organizations?page=" + (page + 1),
  };
  if (page > 0) {
    doc["previousPage"] = "/oslo-api/organizations?page=" + (page - 1);
  }
  doc["members"] = organizations;

  res.send(doc);
});

app.get('/oslo-api/apiDocumentation', (req, res) => {
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
      },
      "license": "http://creativecommons.org/ns#license",
    },
    "@id": "http://localhost:3000/apiDocumentation",
    "@type": "ApiDocumentation",
    "license": "https://overheid.vlaanderen.be/sites/default/files/documenten/ict-egov/licenties/hergebruik/modellicentie_gratis_hergebruik_v1_0.html",
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
  res.send(apiDocumentation);
});

app.listen(3000, () => console.log('Example app listening on port 3000!'))