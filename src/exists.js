import { access } from "fs";

export default path => new Promise(resolve => access(path, err => resolve(!err)));
