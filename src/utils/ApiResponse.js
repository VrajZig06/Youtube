class ApiResposne {
  constructor(statuscode, data, message = "Success") {
    this.statuscode = statuscode;
    this.data = data;
    this.message = message;
    // this.success = statuscode < 400;
  }
}

module.exports = { ApiResposne };
