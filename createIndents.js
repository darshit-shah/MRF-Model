var fs = require('fs');
var debug = require('debug')('model:model')
var utils={
    readCSVFile: function(path, fieldsLength, convertUpper){
        var data = fs.readFileSync(path);
        var rows = data.toString().split("\r\n")
        for (var rIndex = 0; rIndex < rows.length; rIndex++) {
            if(rows[rIndex].length>0){
                rows[rIndex]=rows[rIndex].split(",");
                if(rows[rIndex].length != fieldsLength){
                    console.log(fieldsLength," fields required. Found: ",rows[rIndex].length, "Data: ", rows[rIndex]);
                    rows.splice(rIndex, 1);
                    rIndex--;
                }
                else {
                    if(convertUpper!=false){
                        for (var fIndex = 0; fIndex < rows[rIndex].length; fIndex++) {
                            rows[rIndex][fIndex] = rows[rIndex][fIndex].toUpperCase();
                        }
                    }
                }
            }
            else {
                rows.splice(rIndex, 1);
                rIndex--;
            }
        }
        return rows;
    },
    JSON2CSV: function (objArray, includeHeader) {
        var array = typeof objArray != 'object' ? [objArray] : objArray;
        //console.log(typeof objArray);
        var str = '';
        var tempData = [];
        if (array.length > 0) {
            var keys = Object.keys(array[0]);
            if (includeHeader != false) {
                //str += keys.join(',') + '\r\n';
                tempData.push(keys.join(','));
            }
            //   console.log('JSON2CSV called for Array Size:', objArray.length, ' and keys size: ', keys.length);
            //append data
            for (var k = 0; k < array.length; k++) {
                var line = [];
                for (var index = 0; index < keys.length; index++) {
                    if (array[k].hasOwnProperty(keys[index])) {
                        var val = array[k][keys[index]];
                        if (typeof val == 'string' && val != null) {
                            if (val.indexOf(',') != -1)
                                line.push('"' + val + '"');
                            else
                                line.push(val);
                        }
                        else if (Object.prototype.toString.call(val) === '[object Date]') {
                            line.push(dateTimeFormat.formatDate(val, "yyyy-MM-dd HH:mm:ss"));
                        }
                        else {
                            line.push(val);
                        }
                    }
                }
                //str += line.join(',') + '\r\n';
                tempData.push(line.join(','));
            }
            return tempData.join('\r\n') + '\r\n';
        }
    }
}

var filesDIR="";
if(process.argv.length === 3){
    filesDIR = process.argv[2];
    if(filesDIR[filesDIR.length-1] !== '/'){
        filesDIR += "/";
    }
}

function createIndents(){
    var output = utils.readCSVFile(filesDIR+'output.csv', 5, true);
    var demand = utils.readCSVFile(filesDIR+'Step11_Demand_Destination_Wise.csv', 6, true);
    var destCount = utils.readCSVFile(filesDIR+'IndentCountConstraint.csv', 6, true);

    var outputClusterTruckType={};
    for (var i = 1; i < output.length; i++) {
        var currRow = output[i];
        var clusterTruckTypeKey = currRow[0]+":::"+currRow[2];
        var operatorKey=currRow[1];
        var part=currRow[3];
        var supply=parseInt(currRow[4]);
        if(!outputClusterTruckType.hasOwnProperty(clusterTruckTypeKey)){
            outputClusterTruckType[clusterTruckTypeKey]={};
        }
        if(!outputClusterTruckType[clusterTruckTypeKey].hasOwnProperty(operatorKey)){
            outputClusterTruckType[clusterTruckTypeKey][operatorKey]=[];
        }
        outputClusterTruckType[clusterTruckTypeKey][operatorKey].push({part:part, supply:supply});
    }
    // debug(outputClusterTruckType);

    var destCountClusterTruckType={};
    for (var i = 1; i < destCount.length; i++) {
        var currRow = destCount[i];
        var clusterTruckTypeKey = currRow[0]+":::"+currRow[2];
        var operatorKey=currRow[1];
        var destination=currRow[3];
        var count=currRow[4];
        if(!destCountClusterTruckType.hasOwnProperty(clusterTruckTypeKey)){
            destCountClusterTruckType[clusterTruckTypeKey]={};
        }
        if(!destCountClusterTruckType[clusterTruckTypeKey].hasOwnProperty(destination)){
            destCountClusterTruckType[clusterTruckTypeKey][destination]={};
        }
        if(!destCountClusterTruckType[clusterTruckTypeKey][destination].hasOwnProperty(operatorKey)){
            destCountClusterTruckType[clusterTruckTypeKey][destination][operatorKey]=count;
        }
        else {
            throw Error("Same combination came more than once time", clusterTruckTypeKey, destination, operatorKey);
        }
    }
    // debug(destCountClusterTruckType);

    function selectOperatorForDestination(clusterTruckTypeKey, destination, operators){
        if(!destCountClusterTruckType.hasOwnProperty(clusterTruckTypeKey)){
            destCountClusterTruckType[clusterTruckTypeKey]={};
        }
        if(!destCountClusterTruckType[clusterTruckTypeKey].hasOwnProperty(destination)){
            destCountClusterTruckType[clusterTruckTypeKey][destination]={};
        }
        operators.forEach(function(operator){
            if(!destCountClusterTruckType[clusterTruckTypeKey][destination].hasOwnProperty(operator)){
                destCountClusterTruckType[clusterTruckTypeKey][destination][operator]=0;
            }
        });

        // debug("Sorting", destCountClusterTruckType[clusterTruckTypeKey][destination]);
        // operators = Object.keys(destCountClusterTruckType[clusterTruckTypeKey][destination]);
        var selectedOperator=null;
        var minValue=+Infinity;
        operators.every(function(operator){
            var currValue = destCountClusterTruckType[clusterTruckTypeKey][destination][operator];
            if(currValue<minValue){
                minValue = currValue;
                selectedOperator = operator;
            }
            if(currValue == 0){
                return false;
            }
            return true;
        });
        if(selectedOperator==null){
            debug(operators);
            throw Error("selectedOperator is null from given operators"+ operators);
        }
        return selectedOperator;
    }

    var indents=[];
    indents.push(["Cluster","TruckType","Destination","operator","Part"]);
    function insertIndents(clusterTruckTypeKey, destination, operator, part, trucks){
        var keys = clusterTruckTypeKey.split(":::");
        for (var i = 0; i < trucks; i++) {
            indents.push([keys[0], keys[1], destination, operator, part]);
        }
    }
    for (var i = 1; i < demand.length; i++) {
        var currRow = demand[i];
        var clusterTruckTypeKey = currRow[2]+":::"+currRow[3];
        var destination=currRow[4];
        var demandValue = parseInt(currRow[5]);
        if(outputClusterTruckType.hasOwnProperty(clusterTruckTypeKey)){
            while(demandValue>0){
                debug({row: i, clusterTruckTypeKey:clusterTruckTypeKey, destination:destination, demand:demandValue});
                var destCountClusterTruckTypeResult = destCountClusterTruckType[clusterTruckTypeKey];
                var outputClusterTruckTypeResult = outputClusterTruckType[clusterTruckTypeKey];
                var operators = Object.keys(outputClusterTruckTypeResult);
                if(operators.length === 0){
                    debug(clusterTruckTypeKey, demandValue)
                    throw Error("No operators");
                }
                var selectedOperator = selectOperatorForDestination(clusterTruckTypeKey, destination, operators);
                destCountClusterTruckType[clusterTruckTypeKey][destination][selectedOperator]++;
                // debug("Selected Operator", selectedOperator, "for index ", i, demandValue);
                for(var SGIndex = 0;SGIndex<outputClusterTruckTypeResult[selectedOperator].length && demandValue>0 ;SGIndex++){
                    var SGRow = outputClusterTruckTypeResult[selectedOperator][SGIndex];
                    if(SGRow.supply>0){
                        debug({type:"demandValue >= SGRow.supply",operator: selectedOperator, part: SGRow.part, Supply:SGRow.supply, demand:1});
                        insertIndents(clusterTruckTypeKey, destination, selectedOperator, SGRow.part, 1);
                        SGRow.supply -= 1;
                        demandValue -= 1;
                    }
                    else{
                        outputClusterTruckTypeResult[selectedOperator].splice(SGIndex, 1);
                        SGIndex--;
                    }
                }
                if(outputClusterTruckTypeResult[selectedOperator].length === 0){
                    delete outputClusterTruckTypeResult[selectedOperator];
                }
            }
        }
        else {
            //throw Error("Unknown clusterTruckTypeKey : "+ clusterTruckTypeKey);
        }
        // debug("Loop", i);
    }

    fs.writeFileSync(filesDIR+"indents.csv", indents.join("\r\n"));
    debug("Done.");
    process.exit(0);
}


process.on("message", function(m){
    console.log(m);
    if(m.type === "START_PROCESS"){
        createIndents();
    }
    else if(m.type === "KILL"){
        process.exit(0);
    }
});
