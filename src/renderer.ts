import './index.css';
import { Components } from './types/fire-business-api'; 

// typescript gets very snarky when there's no type definitions for things, 
// and getting jquery-ui or semantic-ui to work was a bitch.
// so tell it not to worry about $ (just shut the fuck up about it!!)
// side effect of no longer offering code completion
declare var $ : any;


document.addEventListener('DOMContentLoaded', pageLoaded);

let pad = function(number: number, size : number) {
    var s = String(number);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
}

let getISODate = function(date: Date) {
    const offset = date.getTimezoneOffset()
    date = new Date(date.getTime() - (offset*60*1000))
    return date.toISOString().split('T')[0]
}

function pageLoaded(){

    $('#settings').accordion();

    $(".ui.calendar").calendar({
        monthFirst: false,
        type: 'date',
        formatter: {
            date: function (date : Date, settings : any) {
            if (!date) return '';
            var day = date.getDate();
            var month = date.getMonth() + 1;
            var year = date.getFullYear();
            return year + "-" + pad(month, 2) + "-" + pad(day, 2);
            }
        }
    })

    $('#progressbar').progress();

    $('.ui.dropdown').dropdown();

    window.api.send('page-contents-loaded',"I'm ready");
}

$("#runreport").on('click', function (event : any) {
    event.preventDefault(); 
    var selectedAccount =  $('.ui.dropdown').dropdown("get value");

    $('#progressbar').progress("reset");
    $("#runreport").addClass("loading");
    window.api.send("run-report", { ican: selectedAccount, fromDate: getISODate($("#fromDate").calendar("get date")), toDate: getISODate($("#toDate").calendar("get date")) } ); 
});

$("#saveconfiguration").on('click', function (event : any) {
    event.preventDefault();
    $("#saveconfiguration").addClass("loading");
    window.api.send("save-configuration", { configs : { clientId: $("#clientId").val(), clientKey: $("#clientKey").val(), refreshToken: $("#refreshToken").val() }} ); 
});

window.api.receive("configuration-saved", function(result : any) {
    $("#saveconfiguration").removeClass("loading");
    $('#settings').accordion("close", 0);
    window.api.send('get-accounts');
});

window.api.receive("configs", function(version: string, configs : Configuration) {
    $("#clientId").val(configs.clientId);
    $("#clientKey").val(configs.clientKey);
    $("#refreshToken").val(configs.refreshToken); 
    
    $("#app-version").text(version);

    if (configs.clientId.length != 36) {
        $('#settings').accordion("open", 0);
    } else {
        window.api.send('get-accounts');
    }
});


window.api.receive("progress-update", function(param : any) {
    console.log(param);
    
    $("#progressbar")
        .progress("set total", param.total)
        .progress("set progress", param.progress)
        .progress("set label", `Retrieved ${param.progress} of ${param.total} transactions...`);

    if (param.progress == param.total) {
        $("#runreport").removeClass("loading");
        $("#progressbar").progress("set label", `${param.total} Transactions Retrieved.`);
    }
});

window.api.receive("accounts", function(accounts : Components.Schemas.Account[], selectedAccount?: number) {
    
    var values : any[] = [];

    accounts.forEach((account) => {
        var item : any =  { value: account.ican, name: account.name };
        if (account.ican == selectedAccount) {
            item.selected = true;
        }
        values.push(item);
        
    })

    console.log({ values: values});
    $('.ui.dropdown').dropdown({ values: values });
});

