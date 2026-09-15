export enum statusCode {
    // status code start with 200
    OK = 200,
    Created = 201,
    No_Content = 204,
  
    // status code start with 400
    Bad_Request = 400,
    Unauthorized = 401,
    Payment_Required = 402,
    Forbidden = 403,
    Not_Found = 404,
    Conflict = 409,

    Too_Many_Requests = 429,
  
    // status code start with 500
    Internal_Server_Error = 500,
}
  


export interface ImageType {
    url:string
    key:string
    provider: "CLOUDINARY"|"S3"|"GCP"|"AZURE"|"LOCAL"
}