// solve http://people.brunel.ac.uk/~mastjjb/jeb/or/morelp.html

var fs = require('fs');
var lpsolve = require('lp_solve');

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

var demand = utils.readCSVFile('demand.csv', 4, true);
var supply = utils.readCSVFile('supply.csv', 4, true);

var Row = lpsolve.Row;

var objective = new Row();
var lp = new lpsolve.LinearProgram();

//ClusterWise-Demand
var demandKeys=[];
var demandValues=[];
for (var dIndex = 1; dIndex < demand.length; dIndex++) {
    var localIndex = demandKeys.indexOf(demand[dIndex][1]);
    if(localIndex == -1){
        demandKeys.push(demand[dIndex][1]);
        demandValues.push({ key: demandKeys[demandKeys.length-1], demand: parseInt(demand[dIndex][3]), decisionVariables: [] });
    }
    else {
        demandValues[localIndex].demand += parseInt(demand[dIndex][3]);
    }
}

//ClusterWise-Part1Wise-Demand
var demandMGKeys=[];
var demandMGValues=[];
for (var dIndex = 1; dIndex < demand.length; dIndex++) {
    demandMGKeys.push(demand[dIndex][1]+":::"+demand[dIndex][2]);
    demandMGValues.push({ key: demandMGKeys[demandMGKeys.length-1], demand: parseInt(demand[dIndex][3]), decisionVariables: [] });
}

var decisionVariables=[];

var operatorKeys=[];
var operatorValues=[];

for (var i = 1; i < supply.length; i++) {
    var operatorIndex = operatorKeys.indexOf(supply[i][1]+":::"+supply[i][2]);
    if(operatorIndex == -1){
        operatorKeys.push(supply[i][1]+":::"+supply[i][2]);
        operatorValues.push({ key: operatorKeys[operatorKeys.length-1], supply: supply[i][3], decisionVariables: [] });
        operatorIndex = operatorKeys.length-1;
    }

    var demandIndex = demandKeys.indexOf(supply[i][1]);
    if(demandIndex == -1){
        demandKeys.push(supply[i][1]);
        demandValues.push({ key: demandKeys[demandKeys.length-1], demand: 0, decisionVariables: [] });
        demandIndex = demandKeys.length-1;
    }
    for (var iMG = 1; iMG < 4; iMG++) {
        var demandMGIndex = demandMGKeys.indexOf(supply[i][1]+":::MG"+iMG);
        if(demandMGIndex == -1){
            demandMGKeys.push(supply[i][1]+":::MG"+iMG);
            demandMGValues.push({ key: demandMGKeys[demandMGKeys.length-1], demand: 0, decisionVariables: [] });
            demandMGIndex = demandMGKeys.length-1;
        }
        for (var iSG = 1; iSG < 3; iSG++) {
            var variableName = supply[i][1]+":::"+supply[i][2]+":::"+"MG"+iMG+":::SG"+iSG;//C1_O1_MG1_SG1
            var decisionVariable = lp.addColumn(variableName, true);
            //objective = objective.Add(decisionVariable, 1);
            decisionVariables.push({key:variableName, value:decisionVariable});

            demandValues[demandIndex].decisionVariables.push(decisionVariable);
            demandMGValues[demandMGIndex].decisionVariables.push(decisionVariable);
            operatorValues[operatorIndex].decisionVariables.push(decisionVariable);
        }
    }
}

for (var dIndex = 0; dIndex < demandMGValues.length; dIndex++) {
    console.log(demandKeys, demandMGValues[dIndex].key)
    var cIndex = demandKeys.indexOf(demandMGValues[dIndex].key.split(":::")[0]);
    demandMGValues[dIndex].demandPerc = (1.0 * demandMGValues[dIndex].demand) / demandValues[cIndex].demand;
}

var demandConstraint = [];
for (var dIndex = 0; dIndex < demandKeys.length; dIndex++) {
    demandConstraint.push(new Row());
    if (demandValues[dIndex].decisionVariables.length > 0) {
        for (var j = 0; j < demandValues[dIndex].decisionVariables.length; j++) {
            demandConstraint[dIndex] = demandConstraint[dIndex].Add(demandValues[dIndex].decisionVariables[j], 1);
        }
        lp.addConstraint(demandConstraint[dIndex], 'EQ', demandValues[dIndex].demand, 'demand (' + demandValues[dIndex].key + ')');
    } else {
        lp.addConstraint(demandConstraint[dIndex], 'EQ', 0, 'demand (' + demandValues[dIndex].key + ')');
    }
}

var operatorConstraint = [];
for (var dIndex = 0; dIndex < operatorKeys.length; dIndex++) {
    operatorConstraint.push(new Row());
    if (operatorValues[dIndex].decisionVariables.length > 0) {
        for (var demandMGIndex = 0; demandMGIndex < demandMGKeys.length; demandMGIndex++) {
            var MGConstraint = new Row();
            var MGConstraintAdded=false;
            var demandMGKeyParts = demandMGKeys[demandMGIndex].split(":::");
            var value = operatorValues[dIndex].supply * demandMGValues[demandMGIndex].demandPerc;
            var innerConstraints = new Row();
            var innerConstraintsAdded = false;
            for (var j = 0; j < operatorValues[dIndex].decisionVariables.length; j++) {
                if(operatorValues[dIndex].decisionVariables[j].indexOf(demandMGKeyParts[0]+":::")>-1
                && operatorValues[dIndex].decisionVariables[j].indexOf(":::"+demandMGKeyParts[1])>-1){
                    operatorConstraint[dIndex] = operatorConstraint[dIndex].Add(operatorValues[dIndex].decisionVariables[j], 1);
                    MGConstraint = MGConstraint.Add(operatorValues[dIndex].decisionVariables[j], 1);
                    MGConstraintAdded=true;
                    var SGValue = 0;
                    if(operatorValues[dIndex].decisionVariables[j].indexOf(":::SG1")>-1){
                        SGValue = value * 0.45;
                    }
                    else if(operatorValues[dIndex].decisionVariables[j].indexOf(":::SG2")>-1){
                        SGValue = value * 0.55;
                    }
                    else {
                        throw new Error("invalid Sub Group", operatorValues[dIndex].decisionVariables[j]);
                    }
                    var SGConstraint = new Row();
                    SGConstraint = SGConstraint.Add(operatorValues[dIndex].decisionVariables[j], 1);
                    lp.addConstraint(SGConstraint, 'GE', Math.floor(SGValue), 'MG (' + operatorValues[dIndex].key + ')');
                    lp.addConstraint(SGConstraint, 'LE', Math.ceil(SGValue), 'MG (' + operatorValues[dIndex].key + ')');

                    if(operatorValues[dIndex].decisionVariables[j].indexOf(":::SG1")>-1){
                        innerConstraints = innerConstraints.Add(operatorValues[dIndex].decisionVariables[j], 1);
                        innerConstraintsAdded=true;
                    }
                    else if(operatorValues[dIndex].decisionVariables[j].indexOf(":::SG2")>-1){
                        innerConstraints = innerConstraints.Add(operatorValues[dIndex].decisionVariables[j], -1);
                        innerConstraintsAdded=true;
                    }
                }
            }
            if(innerConstraintsAdded==true){
                lp.addConstraint(innerConstraints, 'LE', 0, 'SG (' + operatorValues[dIndex].key + ')');
            }
            if(MGConstraintAdded == true){
                lp.addConstraint(MGConstraint, 'GE', Math.floor(value), 'MG (' + operatorValues[dIndex].key + ')');
                lp.addConstraint(MGConstraint, 'LE', Math.ceil(value), 'MG (' + operatorValues[dIndex].key + ')');
            }
        }
        lp.addConstraint(operatorConstraint[dIndex], 'EQ', operatorValues[dIndex].supply, 'supply (' + operatorValues[dIndex].key + ')');
    } else {
        lp.addConstraint(operatorConstraint[dIndex], 'EQ', 0, 'supply (' + operatorValues[dIndex].key + ')');
    }
}

var demandMGConstraint = [];
for (var dIndex = 0; dIndex < demandMGKeys.length; dIndex++) {
    demandMGConstraint.push(new Row());
    if (demandMGValues[dIndex].decisionVariables.length > 0) {
        for (var j = 0; j < demandMGValues[dIndex].decisionVariables.length; j++) {
            demandMGConstraint[dIndex] = demandMGConstraint[dIndex].Add(demandMGValues[dIndex].decisionVariables[j], 1);
        }
        lp.addConstraint(demandMGConstraint[dIndex], 'EQ', demandMGValues[dIndex].demand, 'demand (' + demandMGValues[dIndex].key + ')');
    } else {
        lp.addConstraint(demandMGConstraint[dIndex], 'EQ', 0, 'demand (' + demandMGValues[dIndex].key + ')');
    }
}

//console.log("objective", objective);
lp.setObjective(objective);

// console.log(lp.dumpProgram());
var modelResult = lp.solve();
console.log(modelResult);
console.log('objective =', lp.getObjectiveValue());

if(modelResult.code === 0){
    var rows=[];
    rows.push("Cluster,Operator,Part1,Part2,Allocation");
    for (var dIndex = 0; dIndex < decisionVariables.length; dIndex++) {
        console.log(decisionVariables[dIndex].key,' =', lp.get(decisionVariables[dIndex].key));
        var keys = decisionVariables[dIndex].key.split(":::");
        keys.push(lp.get(decisionVariables[dIndex].key));
        rows.push(keys.join());
    }
    fs.writeFileSync("output.csv", rows.join("\r\n"));
}
