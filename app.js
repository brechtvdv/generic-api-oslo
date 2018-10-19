const express = require('express')
const app = express()
const SPARQL = require('sparql-client-2').SPARQL;
const sparql = new (require('sparql-client-2').SparqlClient)('https://data.vlaanderen.be/sparql');

const PAGE_SIZE = 100;
const port = process.argv.length < 4 ? 3000 : process.argv[3];
const baseUrl = process.argv.length < 3 ? 'http://localhost:' + port : process.argv[2] + ':' + port + '/';
const baseUrlWithNginx = process.argv.length > 4 ? process.argv[4] : baseUrl;

app.enable('etag')

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Expose-Headers", "Link");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Cache-Control", "max-age=604800"); // 1 week
  res.header("Content-Type", "application/ld+json");
  res.set('Link', '<' + baseUrlWithNginx + 'oslo-api/apiDocumentation>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation"');

  next();
});

app.get('/', (req, res) => {
  res.redirect('/oslo-api');
});

app.get('/oslo-api', (req, res) => {
  const doc = {
    "@context": [{
      "hydra": "http://www.w3.org/ns/hydra/core#",
      "vocab": baseUrlWithNginx + "oslo-api/apiDocumentation#",
      "EntryPoint": "vocab:EntryPoint",
      "organizations": {
        "@id": "vocab:EntryPoint/organizations",
        "@type": "@id"
      }
    }, baseUrlWithNginx + 'oslo-api/organisatie.jsonld'],
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
    "@context": ["https://www.w3.org/ns/hydra/context.jsonld", 
      baseUrlWithNginx + 'oslo-api/organisatie.jsonld', {
      "hydra": "http://www.w3.org/ns/hydra/core#",
      "vocab": baseUrlWithNginx + "oslo-api/apiDocumentation#",
      "sh": "http://www.w3.org/ns/shacl#",
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
    "@graph": [{
    //'https://data.vlaanderen.be/context/organisatie-basis.jsonld'],
    "@id": orgId,
    "@type": "Organisatie",
    ...bindings
  },
  {
    "@id": baseUrlWithNginx + 'oslo-api/organizations/' + encodeURIComponent(orgId),
    "operation": [
      {
        "@type": "Operation",
        "method": "GET",
        "returns": "https://data.vlaanderen.be/shacl/organisatie-basis#OrganisatieShape"
      },
      {
        "@type": "Operation",
        "method": "PUT",
        "expects": "https://data.vlaanderen.be/shacl/organisatie-basis#OrganisatieShape"
      }]
  }
  ]};

  res.send(doc);
});

app.get('/oslo-api/organizations/', async (req, res) => {
  let page = req.query.page;
  if (!page) {
    return res.redirect('/oslo-api/organizations?page=0');
  }
  page = parseInt(page, 10);
  const offset = page * PAGE_SIZE;
  const response = await sparql.query(SPARQL`
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT DISTINCT * WHERE {
      ?org a <http://www.w3.org/ns/org#Organization>
      OPTIONAL { ?org rdfs:seeAlso ?seeAlso. } .
      OPTIONAL { ?org <http://mu.semte.ch/vocabularies/core/uuid> ?uuid. } .
      OPTIONAL { ?org <http://www.w3.org/2004/02/skos/core#prefLabel> ?label. } .
      OPTIONAL { ?org <http://www.w3.org/ns/regorg#orgStatus> ?status. } .
      OPTIONAL { ?org <http://www.w3.org/2004/02/skos/core#altLabel> ?altLabel. } .
      OPTIONAL { ?org <http://www.w3.org/ns/org#identifier> ?identifier }
    }
    OFFSET ${offset}
    LIMIT ${PAGE_SIZE}`).execute();

  const organizations = response.results.bindings.map((binding) => {
    let bindings = {};
    for (key of Object.keys(binding)) {
      if(key != 'org') bindings[key] = binding[key].value;
    }

    return {
      "@id": binding.org.value,
      "@type": "Organisatie",
      "foaf:isPrimaryTopicOf": {
          "@id": "/oslo-api/organizations/" + encodeURIComponent(binding.org.value)
          //"@type": "foaf:Document"
      }
      //,
      //...bindings
  }});

  const doc = {
    "@context": [baseUrlWithNginx + 'oslo-api/organisatie.jsonld',
      {"hydra": "http://www.w3.org/ns/hydra/core#",
      "vocab": baseUrlWithNginx + "oslo-api/apiDocumentation#",
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
      "foaf": "http://xmlns.com/foaf/0.1/",
      "OrganizationPartialCollection": {
        "@id": "vocab:OrganizationPartialCollection"
      },
      "foaf:primaryTopic": {
        "@type": "@id"
      },
      "members": "hydra:member",
      "firstPage": {
        "@id": "hydra:first",
        "@type": "@id"
      },
      "nextPage": {
        "@id": "hydra:next",
        "@type": "@id"
      },
      "previousPage": {
        "@id": "hydra:previous",
        "@type": "@id"
      }
    }],
    "@id": "/oslo-api/organizations?page=" + page,
    "@type": "OrganizationPartialCollection",
    "hydra:manages": "Organisatie",
    "firstPage": "/oslo-api/organizations?page=0"
  };
  if (page > 0) {
    doc["previousPage"] = "/oslo-api/organizations?page=" + (page - 1);
  }
  if (organizations.length === PAGE_SIZE) {
    doc["nextPage"] = "/oslo-api/organizations?page=" + (page + 1)
  }
  doc["members"] = organizations;

/*  let etag = 'W/"' + md5(doc) + '"';
  res.setHeader('ETag', etag);*/
  res.setHeader('Cache-Control', 'public, max-age=1000');
  res.send(doc);
});

app.get('/oslo-api/apiDocumentation', (req, res) => {
  const apiDocumentation = {
    "@context": [{
      "vocab": baseUrlWithNginx + "oslo-api/apiDocumentation#",
      "hydra": "http://www.w3.org/ns/hydra/core#",
      "ApiDocumentation": "hydra:ApiDocumentation",
      "property": {
        "@id": "hydra:property",
        "@type": "@id"
      },
      "readonly": "hydra:readonly",
      "writeonly": "hydra:writeonly",
      "required": "hydra:required",
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
      "license": "http://creativecommons.org/ns#license"
    }, baseUrlWithNginx + 'oslo-api/organisatie.jsonld'],
    "@id": baseUrlWithNginx + "oslo-api/apiDocumentation",
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
      /*{
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
            "expects": "https://data.vlaanderen.be/shacl/organisatie-basis#OrganisatieShape",
            "returns": "https://data.vlaanderen.be/shacl/organisatie-basis#OrganisatieShape",
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
            "expects": "https://data.vlaanderen.be/shacl/organisatie-basis#OrganisatieShape",
            "returns": "https://data.vlaanderen.be/shacl/organisatie-basis#OrganisatieShape",
            "statusCodes": []
          }
        ],
        "supportedProperty": []
      },*/
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
              "range": "vocab:OrganizationPartialCollection",
              "supportedOperation": [
                {
                  "@id": "_:Organization_collection_retrieve",
                  "@type": "hydra:Operation",
                  "method": "GET",
                  "label": "Retrieves all Organization entities",
                  "description": null,
                  "expects": null,
                  "returns": "vocab:OrganizationPartialCollection",
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
        "@id": "vocab:OrganizationPartialCollection",
        "@type": "hydra:Class",
        "subClassOf": "http://www.w3.org/ns/hydra/core#PartialCollectionView",
        "label": "OrganizationCollection",
        "description": "A partial collection of Organizations",
        "supportedOperation": [
          {
            "@id": "_:Organization_collection_retrieve",
            "@type": "hydra:Operation",
            "method": "GET",
            "label": "Retrieves a page of Organization entities",
            "description": null,
            "expects": null,
            "returns": "vocab:OrganizationPartialCollection",
            "statusCodes": []
          }
        ],
        "supportedProperty": [
          {
            "property": "http://www.w3.org/ns/hydra/core#member",
            "hydra:title": "members",
            "hydra:description": "The Organizations of this page",
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

app.get('/oslo-api/organisatie.jsonld', (req, res) => {
  const organisatieContext = {
  "@context":
  {
    "Vervanging":"http://data.vlaanderen.be/ns/organisatie#Vervanging",
    "Fusie":"http://data.vlaanderen.be/ns/organisatie#Fusie",
    "Splitsing":"http://data.vlaanderen.be/ns/organisatie#Splitsing",
    "Hoedanigheid":"http://data.vlaanderen.be/ns/organisatie#Hoedanigheid",
    "Positie":"http://www.w3.org/ns/org#Post",
    "FormeelKader":"http://purl.org/vocab/cpsv#FormalFramework",
    "Stopzetting":"http://data.vlaanderen.be/ns/organisatie#Stopzetting",
    "Oprichting":"http://data.europa.eu/m8g/FoundationEvent",
    "PubliekeOrganisatie":"http://data.europa.eu/m8g/PublicOrganisation",
    "GeregistreerdeOrganisatie":"http://www.w3.org/ns/regorg#RegisteredOrganization",
    "Samenwerkingsverband":"http://www.w3.org/ns/org#OrganizationalCollaboration",
    "Veranderingsgebeurtenis":"http://www.w3.org/ns/org#ChangeEvent",
    "Persoon":"http://www.w3.org/ns/person#Person",
    "AdresseerbaarObject":"http://data.vlaanderen.be/ns/adres#AdresseerbaarObject",
    "Vestiging":"http://www.w3.org/ns/org#Site",
    "Lidmaatschap":"http://www.w3.org/ns/org#Membership",
    "Agent":"http://purl.org/dc/terms/Agent",
    "FormeleOrganisatie":"http://www.w3.org/ns/org#FormalOrganization",
    "OrganisatieEenheid":"http://www.w3.org/ns/org#OrganizationalUnit",
    "Organisatie": "http://www.w3.org/ns/org#Organization",
    "vindtPlaatsBinnen":{
      "@id":"http://data.europa.eu/m8g/hasFormalFramework",
      "@type":"http://purl.org/vocab/cpsv#FormalFramework",
      "@container":"@set"
    },
    "heeftSuborganisatie":{
      "@id":"http://www.w3.org/ns/org#hasSubOrganization",
      "@type":"http://www.w3.org/ns/org#Organization",
      "@container":"@set"
    },
    "isVeranderdDoor":{
      "@id":"http://www.w3.org/ns/org#changedBy",
      "@type":"http://www.w3.org/ns/org#ChangeEvent",
      "@container":"@set"
    },
    "wordtIngevuldDoor":{
      "@id":"http://www.w3.org/ns/org#heldBy",
      "@type":"http://purl.org/dc/terms/Agent"
    },
    "isSuborganisatieVan":{
      "@id":"http://www.w3.org/ns/org#subOrganizationOf",
      "@type":"http://www.w3.org/ns/org#Organization",
      "@container":"@set"
    },
    "houdt":{
      "@id":"http://www.w3.org/ns/org#holds",
      "@type":"http://www.w3.org/ns/org#Post",
      "@container":"@set"
    },
    "heeftOorspronkelijkeOrganisatie":{
      "@id":"http://www.w3.org/ns/org#originalOrganization",
      "@type":"http://www.w3.org/ns/org#Organization",
      "@container":"@set"
    },
    "isLidVan":{
      "@id":"http://www.w3.org/ns/org#memberOf",
      "@type":"http://www.w3.org/ns/org#Organization",
      "@container":"@set"
    },
    "heeftResulterendeOrganisatie":{
      "@id":"http://www.w3.org/ns/org#resultingOrganization",
      "@type":"http://www.w3.org/ns/org#Organization",
      "@container":"@set"
    },
    "heeftGeregistreerdeVestiging":{
      "@id":"http://www.w3.org/ns/org#hasRegisteredSite",
      "@type":"http://www.w3.org/ns/org#Site",
      "@container":"@set"
    },
    "heeftPrimaireVestiging":{
      "@id":"http://www.w3.org/ns/org#hasPrimarySite",
      "@type":"http://www.w3.org/ns/org#Site",
      "@container":"@set"
    },
    "isGeassocieerdMet":{
      "@id":"http://www.w3.org/ns/org#linkedTo",
      "@type":"http://www.w3.org/ns/org#Organization",
      "@container":"@set"
    },
    "heeft":{
      "@id":"http://www.w3.org/ns/org#hasPost",
      "@type":"http://www.w3.org/ns/org#Post",
      "@container":"@set"
    },
    "Agent.isLidVan":{
      "@id":"http://www.w3.org/ns/org#hasMembership",
      "@type":"http://www.w3.org/ns/org#Membership"
    },
    "Lidmaatschap.isLidVan":{
      "@id":"http://www.w3.org/ns/org#member",
      "@type":"http://purl.org/dc/terms/Agent",
      "@container":"@set"
    },
    "Lidmaatschap.isLidVan":{
      "@id":"http://www.w3.org/ns/org#organization",
      "@type":"http://www.w3.org/ns/org#Organization",
      "@container":"@set"
    },
    "rapporteertAan":{
      "@id":"http://www.w3.org/ns/org#reportsTo",
      "@type":"http://www.w3.org/ns/org#Post",
      "@container":"@set"
    },
    "heeftStandplaats":{
      "@id":"http://www.w3.org/ns/org#basedAt",
      "@type":"http://www.w3.org/ns/org#Site",
      "@container":"@set"
    },
    "heeftVestiging":{
      "@id":"http://www.w3.org/ns/org#hasSite",
      "@type":"http://www.w3.org/ns/org#Site",
      "@container":"@set"
    },
    "heeftGeregistreerdeOrganisatie":{
      "@id":"http://www.w3.org/ns/regorg#hasRegisteredOrganization",
      "@type":"http://www.w3.org/ns/regorg#RegisteredOrganization",
      "@container":"@set"
    },
    "isEenheidVan":{
      "@id":"http://www.w3.org/ns/org#unitOf",
      "@type":"http://www.w3.org/ns/org#Organization"
    },
    "heeftEenheid":{
      "@id":"http://www.w3.org/ns/org#hasUnit",
      "@type":"http://www.w3.org/ns/org#OrganizationalUnit",
      "@container":"@set"
    },
    "isHetResultaatVan":{
      "@id":"http://www.w3.org/ns/org#resultedFrom",
      "@type":"http://www.w3.org/ns/org#ChangeEvent",
      "@container":"@set"
    },
    "isPositieIn":{
      "@id":"http://www.w3.org/ns/org#postIn",
      "@type":"http://www.w3.org/ns/org#Organization",
      "@container":"@set"
    },
    "isHoofdVan":{
      "@id":"http://www.w3.org/ns/org#headOf",
      "@type":"http://www.w3.org/ns/org#Organization",
      "@container":"@set"
    },
    "bestaatUit":{
      "@id":"http://data.vlaanderen.be/ns/organisatie#bestaatUit",
      "@type":"http://data.vlaanderen.be/ns/adres#AdresseerbaarObject",
      "@container":"@set"
    },
    "contactinfo":{
      "@id":"http://data.vlaanderen.be/ns/organisatie#contactinfo",
      "@type":"http://schema.org/ContactPoint",
      "@container":"@set"
    },
    "rol":{
      "@id":"http://www.w3.org/ns/org#role",
      "@type":"http://www.w3.org/ns/org#Role"
    },
    "aanschrijfvorm":{
      "@id":"http://ww.w3.org/2006/vcard/ns#honorific-prefix",
      "@type":"http://www.w3.org/1999/02/22-rdf-syntax-ns#langString"
    },
    "contactnaam":{
      "@id":"http://xmlns.com/foaf/0.1/name",
      "@type":"http://www.w3.org/2001/XMLSchema#string"
    },
    "email":{
      "@id":"http://schema.org/email",
      "@type":"http://www.w3.org/2001/XMLSchema#string"
    },
    "telefoon":{
      "@id":"http://schema.org/telephone",
      "@type":"http://www.w3.org/2001/XMLSchema#string"
    },
    "fax":{
      "@id":"http://schema.org/faxNumber",
      "@type":"http://www.w3.org/2001/XMLSchema#string"
    },
    "website":{
      "@id":"http://xmlns.com/foaf/0.1/page",
      "@type":"http://www.w3.org/2001/XMLSchema#anyURI"
    },
    "openingsuren":{
      "@id":"http://schema.org/openingHours",
      "@type":"https://schema.org/OpeningHoursSpecification"
    },
    "beschikbaarheid":{
      "@id":"http://schema.org/hoursAvailable",
      "@type":"https://schema.org/OpeningHoursSpecification"
    },
    "adres":{
      "@id":"http://www.w3.org/ns/locn#address",
      "@type":"http://www.w3.org/ns/locn#Address"
    },
    "redenStopzetting":{
      "@id":"http://data.vlaanderen.be/ns/organisatie#redenStopzetting",
      "@type":"http://www.w3.org/2004/02/skos/core#Concept"
    },
    "werkingsgebied":{
      "@id":"http://purl.org/dc/terms/spatial",
      "@type":"http://www.w3.org/2004/02/skos/core#Concept",
      "@container":"@set"
    },
    "registratie":{
      "@id":"http://www.w3.org/ns/regorg#registration",
      "@type":"http://www.w3.org/ns/adms#Identifier"
    },
    "wettelijkeNaam":{
      "@id":"http://www.w3.org/ns/regorg#legalName",
      "@type":"http://www.w3.org/1999/02/22-rdf-syntax-ns#langString"
    },
    "rechtsvorm":{
      "@id":"http://data.vlaanderen.be/ns/organisatie#rechtsvorm",
      "@type":"http://www.w3.org/2004/02/skos/core#Concept"
    },
    "rechtstoestand":{
      "@id":"http://data.vlaanderen.be/ns/organisatie#rechtstoestand",
      "@type":"http://www.w3.org/2004/02/skos/core#Concept"
    },
    "rechtspersoonlijkheid":{
      "@id":"http://data.vlaanderen.be/ns/organisatie#rechtspersoonlijkheid",
      "@type":"http://www.w3.org/2004/02/skos/core#Concept"
    },
    "datum":{
      "@id":"http://purl.org/dc/terms/date"
      // "@type":""
    },
    "vestigingsAdres":{
      "@id":"http://www.w3.org/ns/org#siteAddress",
      "@type":"http://schema.org/ContactPoint"
    },
    "lidVanTot":{
      "@id":"http://www.w3.org/ns/org#memberDuring",
      "@type":"http://purl.org/dc/terms/PeriodOfTime"
    },
    "beschrijving":{
      "@id":"http://purl.org/dc/terms/description",
      "@type":"http://www.w3.org/1999/02/22-rdf-syntax-ns#langString"
    },
    "doel":{
      "@id":"http://www.w3.org/ns/org#purpose",
      "@type":"http://www.w3.org/1999/02/22-rdf-syntax-ns#langString",
      "@container":"@set"
    },
    "classificatie":{
      "@id":"http://www.w3.org/ns/org#classification",
      "@type":"http://www.w3.org/2004/02/skos/core#Concept",
      "@container":"@set"
    },
    "homepage":{
      "@id":"http://xmlns.com/foaf/0.1/homepage",
      "@type":"http://www.w3.org/2001/XMLSchema#string"
    },
    "voorkeursNaam":{
      "@id":"http://www.w3.org/2004/02/skos/core#prefLabel",
      "@type":"http://www.w3.org/1999/02/22-rdf-syntax-ns#langString"
    },
    "alternatieveNaam":{
      "@id":"http://www.w3.org/2004/02/skos/core#altLabel",
      "@type":"http://www.w3.org/1999/02/22-rdf-syntax-ns#langString",
      "@container":"@set"
    },
    "logo":{
      "@id":"http://schema.org/logo"
      // "@type":""
    },
    "activiteit":{
      "@id":"http://www.w3.org/ns/regorg#orgActivity",
      "@type":"http://www.w3.org/2004/02/skos/core#Concept"
    },
    "Organisatie.contactinfo":{
      "@id":"http://schema.org/contactPoint",
      "@type":"http://schema.org/ContactPoint",
      "@container":"@set"
    },
    "type":{
      "@id":"http://www.w3.org/ns/regorg#orgType",
      "@type":"http://www.w3.org/2004/02/skos/core#Concept",
      "@container":"@set"
    },
    "status":{
      "@id":"http://www.w3.org/ns/regorg#orgStatus",
      "@type":"http://www.w3.org/2004/02/skos/core#Concept",
      "@container":"@set"
    }
  }};
  res.send(JSON.stringify(organisatieContext));
});

app.listen(port, () => console.log('Example app listening on port ' + port + '!'))