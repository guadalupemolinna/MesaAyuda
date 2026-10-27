/*-----------------------------------------------------------------------------------------------------------------
//*  MesaAyuda.js debe copiarse al directorio del proyecto express como index.js
//*
//*  REST API 
//*  UADER - FCyT - Ingenieria de Software I 
//*  Caso de estudio MesaAyuda
//*
//*  Dr. Pedro E. Colla 2023,2025
 *----------------------------------------------------------------------------------------------------------------*/
//AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE=1

import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import AWS from 'aws-sdk';
import accessKeyId from '../accessKeyId.js';
import secretAccessKey  from '../secretAccessKey.js';

console.log("Comenzando servidor");
console.log("crypto Ok!");

const app = express();
console.log("express ready!");

const PORT = 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
console.log("CORS ready!");

console.log("aws-sdk ready!");

let awsConfig = {
    "region"         : "us-east-1",
    "endpoint"       : "http://dynamodb.us-east-1.amazonaws.com",
    "accessKeyId"    : accessKeyId, 
    "secretAccessKey": secretAccessKey
};
AWS.config.update(awsConfig);
let docClient = new AWS.DynamoDB.DocumentClient();

/*==================== FUNCIONES AUXILIARES ====================*/

/*-----------
función para hacer el parse de un archivo JSON
*/
function jsonParser(keyValue,stringValue) {
    var string = JSON.stringify(stringValue);
    var objectValue = JSON.parse(string);
    return objectValue[keyValue];
}

/*---------
Función para realizar el SCAN de un DB de cliente usando contacto como clave para la búsqueda (no es clave formal del DB)
*/
async function scanDb(contacto) {
    var docClient = new AWS.DynamoDB.DocumentClient();
    const scanKey=contacto;
    const paramsScan = { // ScanInput
      TableName: "cliente", // required
      Select: "ALL_ATTRIBUTES" || "ALL_PROJECTED_ATTRIBUTES" || "SPECIFIC_ATTRIBUTES" || "COUNT",
      FilterExpression : 'contacto = :contacto',
      ExpressionAttributeValues : {':contacto' : scanKey}
    };      
    var objectPromise = await docClient.scan(paramsScan).promise().then((data) => {
          return data.Items 
    });  
    return objectPromise;
}
async function scanDbTicket(clienteID) {
    var docClient = new AWS.DynamoDB.DocumentClient();
    const scanKey=clienteID;
    const paramsScan = { // ScanInput
      TableName: "ticket", // required
      Select: "ALL_ATTRIBUTES" || "ALL_PROJECTED_ATTRIBUTES" || "SPECIFIC_ATTRIBUTES" || "COUNT",
      FilterExpression : 'clienteID = :clienteID',
      ExpressionAttributeValues : {':clienteID' : scanKey}
    };      
    var objectPromise = await docClient.scan(paramsScan).promise().then((data) => {
          return data.Items 
    });  
    return objectPromise;
}

/*==================== API REST DE CLIENTES ====================*/

/*-------------------------------------------------------------------------------------------
                            SERVER API 
 *-------------------------------------------------------------------------------------------*/
/*==*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*
 *                       API REST Cliente                                                   *
 *=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*==*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*/

app.get('/api/cliente', (req,res) => {
    res.status(200).send({response : "OK", message : "API Ready"});
    console.log("API cliente: OK");
});


/*---
  /api/loginCliente
  Esta API permite acceder a un cliente por ID y comparar la password pasada en un JSON en el cuerpo con la indicada en el DB
*/  
/* MODIFICACION:Busca en la tabla cliente el registro cuyo contacto coincide con el correo recibido.*/

app.post('/api/loginCliente', async (req, res) => {
    const { contacto } = req.body;
    const {password} = req.body;


    console.log("loginCliente: contacto("+contacto+")"); /*-MODIFICADO pto 1*/

    if (!password) {
        res.status(400).send({response : "ERROR" , message : "Password no informada"});
        return;
    }    
    if (!contacto) {
        res.status(400).send({response : "ERROR" , message : "correo no informado"}); /*-MODIFICADO pto 1*/
        return;
    }  
        try {
        const clientes = await scanDb(contacto);
        const cliente = clientes[0];

        if (!cliente ||
            cliente.password !== password ||
            cliente.activo !== true) {
            return res.status(400).send({ response: "invalido" });
        }

        return res.status(200).send({
            response: "OK",
            id: cliente.id,
            nombre: cliente.nombre,
            contacto: cliente.contacto,
            fecha_ultimo_ingreso: cliente.fecha_ultimo_ingreso
        });
    } catch (error) {
        console.error("Error al buscar cliente");
        return res.status(500).send({ response: "ERROR" });
    }
}); 
    

/*----
addCliente
Revisa si el contacto (e-mail) existe y en caso que no da de alta el cliente generando un id al azar
*/
app.post('/api/addCliente', (req,res) => {

    const {contacto} = req.body;
    const {password} = req.body;
    const {nombre}   = req.body;
    console.log("addCliente: contacto("+contacto+") nombre("+nombre+"))");
    
    if (!password) {
        res.status(400).send({response : "ERROR" , message: "Password no informada"});
        return;
    }
    if (!nombre) {
        res.status(400).send({response : "ERROR", message : "Nombre no informado"});
        return;
    }

    if (!contacto){
        res.status(400).send({response : "ERROR" , message : "Contacto no informado"});
        return;
    } 

    scanDb(contacto)
    .then(resultDb => {
      if (Object.keys(resultDb).length != 0) {
        res.status(400).send({response : "ERROR" , message : "Cliente ya existe"});
        return;
      } else {
        var hoy = new Date();
        var dd = String(hoy.getDate()).padStart(2, '0');
        var mm = String(hoy.getMonth() + 1).padStart(2, '0'); //January is 0!
        var yyyy = hoy.getFullYear();
        hoy = dd + '/' + mm + '/' + yyyy;
    
        const newCliente = {
         id: crypto.randomUUID(),
         contacto              : contacto,
         nombre                : nombre,
         password              : password,
         activo                : true,
         registrado            : true,
         primer_ingreso        : false,
         fecha_alta            : hoy,
         fecha_cambio_password : hoy,
         fecha_ultimo_ingreso  : hoy,
        };
    
        const paramsPut = {
          TableName: "cliente",
          Item: newCliente,
          ConditionExpression:'attribute_not_exists(id)',
        };

        docClient.put(paramsPut, function (err, data) {
            if (err) {
                res.status(400).send(JSON.stringify({response : "ERROR", message : "DB error" + err}));
            } else {
                res.status(200).send(JSON.stringify({response : "OK"}));
            }
        });
    }
    });

});
/*----------
/api/updateCliente
Permite actualizar datos del cliente contacto, nombre, estado de activo y registrado
*/
app.post('/api/updateCliente', (req,res) => {
    
    const {id} = req.body;
    const {nombre}   = req.body; 
    const {password} = req.body;

    var activo = ((req.body.activo+'').toLowerCase() === 'true')
    var registrado = ((req.body.registrado+'').toLowerCase() === 'true')

    console.log("updateCliente: id("+id+") nombre("+nombre+") activo("+activo+") registrado("+registrado+")");

    if (!id) {
        res.status(400).send({response : "ERROR" , message: "Id no informada"});
        return;
    }

    if (!nombre) {
        res.status(400).send({response : "ERROR" , message: "Nombre no informado"});
        return;
    }

    if (!password) {
        res.status(400).send({response : "ERROR" , message: "Password no informado"});
        return;
    }

    var params = {
        TableName: "cliente",
        Key: {
            "id" : id
            //test use "id": "0533a95d-7eef-4c6b-b753-1a41c9d1fbd0"   
             }
        };
        
    docClient.get(params, function (err, data) {
        if (err)  {
            res.status(400).send(JSON.stringify({response : "ERROR", message : "DB access error "+ null}));
            return;
        } else {

            if (Object.keys(data).length == 0) {
                res.status(400).send(JSON.stringify({"response":"ERROR",message : "Cliente no existe"}),null,2);
                return;
            } else {

                const paramsUpdate = { 
   
                    ExpressionAttributeNames: { 
                         "#a": "activo", 
                         "#n": "nombre",
                         "#p": "password",
                         "#r": "registrado"

                    }, 
                    ExpressionAttributeValues: { 
                        ":a": activo , 
                        ":p": password,
                        ":n": nombre , 
                        ":r": registrado 
                   }, 
                   Key: { 
                       "id": id 
                   }, 
                   ReturnValues: "ALL_NEW", 
                   TableName: "cliente", 
                   UpdateExpression: "SET #n = :n, #p = :p, #a = :a, #r = :r" 
                };
                docClient.update(paramsUpdate, function (err, data) {
                    if (err)  {
                        res.status(400).send(JSON.stringify({response : "ERROR", message : "DB access error "+err}));
                        return;
                    } else {
                        res.status(200).send(JSON.stringify({response : "OK", message : "updated" , "data": data}));
                    }    
                });    
            }
        }    
    })


});
/*-------
/api/resetCliente
Permite cambiar la password de un cliente
*/
app.post('/api/resetCliente', async (req, res) => {
    const { contacto, password } = req.body;

    if (!contacto) {
        return res.status(400).send({
            response: "ERROR",
            message: "Correo no informado"
        });
    }

    if (!password) {
        return res.status(400).send({
            response: "ERROR",
            message: "Password no informada"
        });
    }

    try {
        const clientes = await scanDb(contacto);
        const cliente = clientes[0];

        if (!cliente) {
            return res.status(404).send({
                response: "ERROR",
                message: "Cliente no existe"
            });
        }

        const paramsUpdate = {
            TableName: "cliente",
            Key: { id: cliente.id },
            UpdateExpression: "SET #p = :p",
            ExpressionAttributeNames: { "#p": "password" },
            ExpressionAttributeValues: { ":p": password },
            ReturnValues: "NONE"
        };

        await docClient.update(paramsUpdate).promise();

        return res.status(200).send({
            response: "OK",
            message: "Password actualizada"
        });
    } catch (error) {
        console.error("Error al restablecer password:", error);
        return res.status(500).send({
            response: "ERROR",
            message: "No se pudo actualizar la password"
        });
    }
});
/*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*

/*==========TICKETS Y ESTADÍSTICAS ==========*/

app.all('/resumenTickets', async (req, res) => {
  
  const idUsuario = req.method === 'GET' 
    ? (req.query.ID || req.query.id || req.query.contacto) 
    : (req.body?.ID || req.body?.id || req.body?.contacto);

  const password = req.method === 'GET' 
    ? (req.query.PASSWORD || req.query.password) 
    : (req.body?.PASSWORD || req.body?.password);

  if (!idUsuario || !password) {
    return res.status(400).json({ response: 'Error', mensaje: 'Faltan credenciales (ID/contacto y PASSWORD)' });
  }

  try {
  
    const paramsCliente = {
      TableName: 'cliente',
      FilterExpression: 'contacto = :c OR id = :id',
      ExpressionAttributeValues: {
        ':c': String(idUsuario),
        ':id': String(idUsuario)
      }
    };

    const dataCliente = await docClient.scan(paramsCliente).promise();
    const cliente = dataCliente.Items && dataCliente.Items[0];

    if (!cliente || cliente.password !== password) {
      return res.status(401).json({ response: 'Error', mensaje: 'Credenciales inválidas' });
    }

    
    const [todosClientes, todosTickets] = await Promise.all([
      docClient.scan({ TableName: 'cliente' }).promise(),
      docClient.scan({ TableName: 'ticket' }).promise()
    ]);

    
    const resumen = (todosClientes.Items || []).map(cli => {
      const cliId = String(cli.id || cli.clienteID || '');
      const cliContacto = String(cli.contacto || '');

      const ticketsDelCliente = (todosTickets.Items || []).filter(t => {
        const tCliente = String(t.clienteID || t.cliente || '');
        return (tCliente !== '' && (tCliente === cliId || tCliente === cliContacto));
      });
      return {
        clienteID: cli.id || cli.clienteID,
        contacto: cli.contacto,
        cantidadTickets: ticketsDelCliente.length,
        tickets: ticketsDelCliente.map(t => ({
          ticketID: t.id || t.ticketID,
          fechaApertura: t.fecha_apertura,
          estado: t.estado_solucion
        }))
      };
    });

    return res.json({
      response: 'Ok',
      resumen: resumen
    });
  } catch (error) {
    console.error('Error en /resumenTickets:', error);
    return res.status(500).json({ response: 'Error', mensaje: error.message });
  }
});


// ==========================================
// ACCESO A TICKETS (/getTicket)
// ==========================================
app.all('/getTicket', async (req, res) => {
  // Extraer parámetros según sea GET o POST
  const idUsuario = req.method === 'GET' ? (req.query.ID || req.query.contacto) : req.body.ID;
  const password = req.method === 'GET' ? req.query.PASSWORD : req.body.PASSWORD;
  const ticketID = req.method === 'GET' ? req.query.TICKET : req.body.TICKET;

  if (!idUsuario || !password || !ticketID) {
    return res.status(400).json({ response: 'Error', mensaje: 'Faltan parámetros (ID, PASSWORD, TICKET)' });
  }

  try {
    // 1. Validar si el cliente existe y su contraseña es correcta
    const paramsCliente = {
      TableName: 'cliente',
      FilterExpression: 'contacto = :c OR id = :id',
      ExpressionAttributeValues: {
        ':c': idUsuario,
        ':id': idUsuario
      }
    };

    const dataCliente = await docClient.scan(paramsCliente).promise();
    const cliente = dataCliente.Items && dataCliente.Items[0];

    // Requisito del TP: Si el cliente no existe/inválido, retornar error SIN consultar el ticket
    if (!cliente || cliente.password !== password) {
      return res.status(401).json({ response: 'Error', mensaje: 'Cliente no existe o contraseña incorrecta' });
    }

    // Consultar el ticket solicitado
    const paramsTicket = {
      TableName: 'ticket',
      KeyConditionExpression: 'id = :tid',
      ExpressionAttributeValues: {
        ':tid': ticketID
      }
    };

    // Si la tabla usa scan por no conocer la clave primaria exacta:
    const dataTicket = await docClient.scan({
      TableName: 'ticket',
      FilterExpression: 'id = :tid OR ticketID = :tid',
      ExpressionAttributeValues: { ':tid': ticketID }
    }).promise();

    const ticketEncontrado = dataTicket.Items && dataTicket.Items[0];

    if (!ticketEncontrado) {
      return res.status(404).json({ response: 'Error', mensaje: 'El ticket especificado no existe' });
    }

    // Retornar los datos combinados
    return res.json({
      response: 'Ok',
      clienteID: cliente.id,
      contacto: cliente.contacto,
      ticket: ticketEncontrado
    });

  } catch (error) {
    console.error('Error en /getTicket:', error);
    return res.status(500).json({ response: 'Error', mensaje: error.message });
  }
});

/*----------
  listarTicket
   obtener todos los tickets de un clienteID
*/  
app.post('/api/listarTicket', (req,res) => {

    const {ID}  = req.body;
    console.log("listarTicket: ID("+ID+")");
 
    if (!ID) {
        res.status(400).send({response : "ERROR" , message: "ID cliente  no informada"});
        return;
    }

    scanDbTicket(ID)
    .then(resultDb => {
      if (Object.keys(resultDb).length == 0) {
        res.status(400).send({response : "ERROR" , message : "clienteID no tiene tickets"});
        return;
      } else {
        res.status(200).send(JSON.stringify({response : "OK",  "data": resultDb}));
    }

    });

});

/*-----------------
/api/addTicket
agregar ticket (genera id)
*/
app.post('/api/addTicket', (req,res) => {

    const {clienteID} = req.body;
    const estado_solucion = 1;
    const {solucion} = req.body;
    const {descripcion} = req.body;

    var hoy = new Date();
    var dd = String(hoy.getDate()).padStart(2, '0');
    var mm = String(hoy.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = hoy.getFullYear();
    hoy = dd + '/' + mm + '/' + yyyy;

    const newTicket = {
     id                    : crypto.randomUUID(),
     clienteID             : clienteID,
     estado_solucion       : estado_solucion,
     solucion              : solucion,
     descripcion           : descripcion,
     fecha_apertura        : hoy,
     ultimo_contacto       : hoy
    };

    const paramsPut = {
      TableName: "ticket",
      Item: newTicket,
      ConditionExpression:'attribute_not_exists(id)',
    };

    docClient.put(paramsPut, function (err, data) {
        if (err) {
            res.status(400).send(JSON.stringify({response : "ERROR", message : "DB error" + err}));
        } else {
            res.status(200).send(JSON.stringify({response : "OK", "ticket": newTicket}));
        }
    });
}
)

/*--------
/api/updateTicket
Dado un id actualiza el ticket, debe informarse la totalidad del ticket
*/
app.post('/api/updateTicket', (req,res) => {

    const {id} = req.body;
    const {clienteID} = req.body;
    const {estado_solucion} = req.body;
    const {solucion} = req.body;
    const {descripcion} = req.body;
    const {fecha_apertura} = req.body;

    if (!id) {
        res.status(400).send({response : "ERROR" , message: "Id no informada"});
        return;
    }

    if (!clienteID) {
        res.status(400).send({response : "ERROR" , message: "clienteID no informada"});
        return;
    }

    if (!estado_solucion) {
        res.status(400).send({response : "ERROR" , message: "estado_solucion no informada"});
        return;
    }

    if (!solucion) {
        res.status(400).send({response : "ERROR" , message: "solucion no informado"});
        return;
    }

    if (!fecha_apertura) {
        res.status(400).send({response : "ERROR" , message: "fecha apertura"});
        return;
    }
    
    var hoy = new Date();
    var dd = String(hoy.getDate()).padStart(2, '0');
    var mm = String(hoy.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = hoy.getFullYear();
    hoy = dd + '/' + mm + '/' + yyyy;

    const ultimo_contacto = hoy;

    var params = {
        TableName: "ticket",
        Key: {
            "id" : id
            //test use "id": "0533a95d-7eef-4c6b-b753-1a41c9d1fbd0"   
             }
        };
        
    docClient.get(params, function (err, data) {
        if (err)  {
            res.status(400).send(JSON.stringify({response : "ERROR", message : "DB access error "+ null}));
            return;
        } else {

            if (Object.keys(data).length == 0) {
                res.status(400).send(JSON.stringify({"response":"ERROR",message : "ticket no existe"}),null,2);
                return;
            } else {

                const paramsUpdate = { 
   
                    ExpressionAttributeNames: { 
                         "#c": "clienteID", 
                         "#e": "estado_solucion",
                         "#s": "solucion",
                         "#a": "fecha_apertura",
                         "#u": "ultimo_contacto",
                         "#d": "descripcion"
                    }, 
                    ExpressionAttributeValues: { 
                        ":c":  clienteID, 
                        ":e":  estado_solucion , 
                        ":s":  solucion , 
                        ":a":  fecha_apertura,
                        ":u":  ultimo_contacto,
                        ":d":  descripcion 
                   }, 
                   Key: { 
                       "id": id 
                   }, 
                   ReturnValues: "ALL_NEW", 
                   TableName: "ticket", 
                   UpdateExpression: "SET #c = :c, #e = :e, #a = :a, #s = :s, #d = :d, #u = :u" 
                };
                docClient.update(paramsUpdate, function (err, data) {
                    if (err)  {
                        res.status(400).send(JSON.stringify({response : "ERROR", message : "DB access error "+err}));
                        return;
                    } else {
                        res.status(200).send(JSON.stringify({response : "OK",  "data": data}));
                    }    
                });    
            }
        }    
    })

});
/*-------------------------------------------------[ Fin del API REST ]-------------------------------------------------------------*/

app.listen(
    PORT,
    () => console.log(`Servidor listo en http://localhost:${PORT}`)
);