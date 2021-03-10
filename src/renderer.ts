import './index.css';

// typescript gets very snarky when there's no type definitions for things, 
// and getting jquery-ui or semantic-ui to work as a bitch.
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
    console.log("Page has loaded");

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

    $('#progressbar').progress({
        text: {
          active  : 'Retrieved {value} of {total} transactions...',
          success : '{total} Transactions Retrieved.'
        }
      });

    window.api.send('page-contents-loaded',"I'm ready");
}

$("#runreport").on('click', function (event : any) {
    event.preventDefault(); 
   $("#runreport").addClass("loading");
    window.api.send("run-report", { fromDate: getISODate($("#fromDate").calendar("get date")), toDate: getISODate($("#toDate").calendar("get date")) } ); 
});

$("#saveconfiguration").on('click', function (event : any) {
    event.preventDefault();
    $("#saveconfiguration").addClass("loading");
    window.api.send("save-configuration", { configs : { clientId: $("#clientId").val(), clientKey: $("#clientKey").val(), refreshToken: $("#refreshToken").val() }} ); 
});

window.api.receive("configuration-saved", function(result : any) {
    $("#saveconfiguration").removeClass("loading");
    $('#settings').accordion("close", 0);
});

window.api.receive("configs", function(configs : Configuration) {
    console.log(configs);
    
    $("#clientId").val(configs.clientId);
    $("#clientKey").val(configs.clientKey);
    $("#refreshToken").val(configs.refreshToken);             

    if (configs.clientId.length != 36) {
        $('#settings').accordion("open", 0);
    }
});

window.api.receive("progress-update", function(param : any) {
    console.log(param);
    
    $("#progressbar")
        .progress("set total", param.total)
        .progress("set progress", param.progress);

    if (param.progress == param.total) {
        $("#runreport").removeClass("loading");
    }
});

