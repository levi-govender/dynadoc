export class EsignError extends Error {
  constructor(
    message: string,
    readonly httpStatus = 400,
  ) {
    super(message);
    this.name = "EsignError";
  }
}
