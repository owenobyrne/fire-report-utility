import './index.css';
import { Paths } from './types/fire-business-api'; 

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
    
    $('#progressbar-accounts').progress();
    $('#progressbar-accounts').css("margin-bottom", "1em");
    
    $('#progressbar-accounts').hide();

    $("#stopreport").hide();
    
    $("#error-modal").modal("hide");

    $('.ui.dropdown').dropdown();

    window.api.send('page-contents-loaded',"I'm ready");
}

$("#beta-modal-ok").on('click', function (event : any) {
    event.preventDefault(); 
    window.api.send("beta-agreement");
    $("#beta-modal").modal("hide");

});

$("#error-modal-ok").on('click', function (event : any) {
    event.preventDefault(); 
    $("#error-modal").modal("hide");

});

$("#runreport").on('click', function (event : any) {
    event.preventDefault(); 
    var selectedAccount =  $('.ui.dropdown').dropdown("get value");

    if (selectedAccount == "all") {
        $('#progressbar').addClass("small");
        $('#progressbar').css("margin-bottom", "1em");
        $('#progressbar-accounts').show();
    } else {
        $('#progressbar-accounts').hide();
        $('#progressbar').removeClass("small");
        $('#progressbar').css("margin-bottom", "2.5em");
        
    }

    $("#progressbar").removeClass("swinging indeterminate");
    $("#runreport").addClass("loading");
    $("#runreport").prop("disabled", true);
    $("#stopreport").show(); 

    window.api.send("run-report", { ican: selectedAccount, fromDate: getISODate($("#fromDate").calendar("get date")), toDate: getISODate($("#toDate").calendar("get date")) } ); 
});

$("#stopreport").on("click", function(event: any) {
    event.preventDefault();
    $("#runreport").prop("disabled", false);
    $("#runreport").removeClass("loading");
    $("#stopreport").hide(); 

    // give any backend stuff time to complete, then reset. (not working for the second bar yet.... weird)
    setTimeout(function() {
        // $('#progressbar-accounts').progress("reset");
        // $('#progressbar').progress("remove success");
        // $('#progressbar').progress("set progress", 0);
        
        $("#progressbar").removeClass("swinging indeterminate");
    
    }, 1000);

    window.api.send("stop-report"); 


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

window.api.receive("report-finished", function(data: any) {
    if (data && data.error) {
        $("#error-modal .content").text(data.error)
        $("#error-modal").modal("show");
    }

    $("#runreport").prop("disabled", false);
    $("#runreport").removeClass("loading");
    $("#stopreport").hide(); 

    // give any backend stuff time to complete, then reset. (not working for the second bar yet.... weird)
    setTimeout(function() {
        // $('#progressbar-accounts').progress("reset");
        // $('#progressbar').progress("remove success");
        // $('#progressbar').progress("set progress", 0);
        
        $("#progressbar").removeClass("swinging indeterminate");
   
    }, 1000);
});

window.api.receive("configs", function(version: string, showBeta: boolean, configs : Configuration) {
    $("#clientId").val(configs.clientId);
    $("#clientKey").val(configs.clientKey);
    $("#refreshToken").val(configs.refreshToken); 
    
    $("#app-version").text(version);

    if (showBeta) { $("#beta-modal").modal("show"); }
    
    if (configs.clientId.length != 36) {
        $('#settings').accordion("open", 0);
    } else {
        window.api.send('get-accounts');
    }
});


window.api.receive("progress-update", function(param : any) {
    console.log(param);
    var allAccountsLabel = "";
    var selectedAccount =  $('.ui.dropdown').dropdown("get value");

    if (selectedAccount == "all") {
        allAccountsLabel = `Account ${param.accountsProcessed} of ${param.totalNumAccounts} /`;
    }
    
    if (param.complete) {
        $("#runreport").removeClass("loading");
        $("#progressbar").removeClass("swinging indeterminate");
        $("#progressbar").progress("set label", " ");

    } else {
        $("#progressbar").addClass("blue swinging indeterminate");
        $("#progressbar").progress("set label", `${allAccountsLabel} Retrieved ${param.progress} transactions...`);
    }
});


window.api.receive("progress-update-accounts", function(param : any) {    
    $("#progressbar-accounts")
        .progress("set total", param.totalNumAccounts)
        .progress("set progress", param.accountsProcessed);

});

window.api.receive("accounts", function(accounts : Paths.GetAccountById.Responses.$200[], selectedAccount?: number) {
    
    var values : any[] = [];
    values.push({ value: "all", name: "All Accounts"});

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

