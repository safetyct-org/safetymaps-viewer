/* 
 * Copyright (c) 2020 B3Partners (info@b3partners.nl) & Safety C&T (info@safetyct.com)
 * 
 * This file is part of safetymaps-viewer.
 * 
 * safetymaps-viewer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * safetymaps-viewer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 *  along with safetymaps-viewer. If not, see <http://www.gnu.org/licenses/>.
 */


/* global safetymaps, dbkjs, OpenLayers, i18n, Mustache */

var dbkjs = dbkjs || {};
window.dbkjs = dbkjs;
dbkjs.modules = dbkjs.modules || {};

dbkjs.modules.kro = {
    id: "dbk.module.kro",
    options: null,
    activated: false,
    rowConfig: null,
    infoWindow: null,
    scrollBottomButton: "",
    scrollTopButton: "",
    
    register: function() {
        var me = dbkjs.modules.kro;

        me.options = $.extend({
            debug: false,
            enableForObjectTypes: ["object"]
        }, me.options);

        me.activated = true;

        me.getObjectInfoRowConfig()
            .fail(function(msg) {
                console.log("Error fetching KRO row config in KRO module: " + msg);
                me.rowConfig = [];
            })
            .done(function(config) {
                me.rowConfig = config;
            });

       /* me.rowConfig = [
            { label: i18n.t("creator.formal_name"), order: 0, source: "dbk" },
            { label: i18n.t("creator.informal_name"), order: 1, source: "dbk" },
            { label: i18n.t("creator.adress"), order: 2, source: "dbk" },
            { label: i18n.t("creator.check_date"), order: 3, source: "dbk" },
            { label: i18n.t("creator.emergencyResponderPresent"), order: 4, source: "dbk" },
            { label: i18n.t("creator.respondingProcedure"), order: 5, source: "dbk" },
            { label: i18n.t("creator.buildingConstruction"), order: 6, source: "dbk" },
            { label: i18n.t("creator.fireAlarmCode"), order: 7, source: "dbk" },
            { label: i18n.t("creator.usage"), order: 8, source: "dbk" },
            { label: i18n.t("creator.usage_specific"), order: 9, source: "dbk" },
            { label: i18n.t("creator.level"), order: 10, source: "dbk" },
            { label: i18n.t("creator.lowestLevel") + " (" + i18n.t("creator.floor") + ")", order: 11, source: "dbk" },
            { label: i18n.t("creator.highestLevel") + " (" + i18n.t("creator.floor") + ")", order: 12, source: "dbk" },
        ];*/
    },

    shouldShowKro: function() {
        var me = dbkjs.modules.kro;

        return me.activated;
    },

    shouldShowKroForObject: function(object) {
        var me = dbkjs.modules.kro;

        if (!me.shouldShowKro()) {
            return false;
        }

        var objectTypeIsEnabled = object.type &&
            me.options.enableForObjectTypes.filter(function(type) { return type.toLowerCase() === object.type.toLowerCase(); }).length > 0;

        return objectTypeIsEnabled;
    },

    callApi: function(params) {
        var me = dbkjs.modules.kro;
        var d = $.Deferred();
        
        if(!me.activated) {
            return;
        }

        $.ajax({
            dataType: "json",
            url: 'api/kro',
            data: params,
            cache: false
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            d.reject(safetymaps.utils.getAjaxError(jqXHR, textStatus, errorThrown));
        })
        .done(function(data, textStatus, jqXHR) {
            d.resolve(data);
        });
        return d.promise();
    },

    getObjectInfoRowConfig: function() {
        var me = dbkjs.modules.kro;
        var params = {
            config: true
        };

        return me.callApi(params);
    },

    getObjectInfoForAddress: function(streetname, housnr, housletter, housaddition, city) {
        var me = dbkjs.modules.kro;
        var params = {
            address: me.createAddressString(streetname, housnr, housletter, housaddition, city),
        };
        
        return me.callApi(params);
    },

    getObjectInfoForBAGvboId: function(bagvboid) {
        var me = dbkjs.modules.kro;
        var params = {
            bagId: bagvboid,
        };
        
        return me.callApi(params);
    },

    getObjectInfoForBAGpandId: function(bagpandid) {

    },

    mergeKroRowsIntoDbkRows: function(dbkRows, kro) {
        var me = dbkjs.modules.kro;
        var kroRows = me.createGeneralRows(kro);

        dbkRows = dbkRows.concat(kroRows);
        dbkRows = me.removeDuplicateObjectInfoRows(dbkRows);
        dbkRows = me.orderObjectInfoRows(dbkRows);

        return dbkRows;
    },

    showKroForIncidentWithoutDbk: function(kro) {
        var me = dbkjs.modules.kro;
        var rows = me.createGeneralRows(kro);
        safetymaps.infoWindow.addTab('incident', "general", i18n.t("creator.general"), "kro", safetymaps.creator.createInfoTabDiv(rows));
    },

    addScrollButtons: function() {
        var me = this;

        setTimeout(function() {
            var content = $("#tab_general.active").parent();
            var bottomPos = content.offset().top + content.outerHeight(true) - 50;

            me.scrollBottomButton = "<button id='gotoBottom' style='display:block; position:absolute; z-index:999; bottom:" + bottomPos + "px; right:15px;'>Meer...</button>";
            me.scrollTopButton = "<button id='gotoTop' style='display:block; position:absolute; z-index:999; top:15px; right:15px;'>Terug</button>";
            
            content.prepend($(me.scrollTopButton));
            content.append($(me.scrollBotomButton));
        }, 500);
    },

    createGeneralRows: function(kro) {
        var typeList = "<table>";
        kro.adres_objecttypering_ordered.map(function(type) {
            typeList += "<tr style='cursor: pointer;' onClick='dbkjs.modules.kro.clickTypeRow(\"" + type + "\")'><td>" + type + "</td></tr>";
        });
        typeList += "</table>";

        return [
            { l: "Monument", t: kro.monument === "" ? "Nee" : "Ja", source: "kro" },
            { l: "Oppervlakte gebouw", t: kro.adres_oppervlak + "m2", source: "kro" },
            { l: "Status", t: kro.pand_status, source: "kro" },
            { l: "Bouwjaar", t: kro.pand_bouwjaar, source: "kro" },
            { l: "Maximale hoogte",t: ("" + kro.pand_maxhoogte + "").replace(".", ",") + "m", source: "kro" },
            { l: "Geschat aantal bouwlagen bovengronds",t: kro.pand_bouwlagen, source: "kro" },
            { l: "Typering (klik voor meer info)", html: typeList, source: "kro" },
        ];
    },

    clickTypeRow: function(type) {
        console.log(type);
    },

    removeDuplicateObjectInfoRows: function(rows) {
        var me = dbkjs.modules.kro;

        return rows
            .filter(function(row) {
                var configFound = me.rowConfig.filter(function(cr) { return cr.label === row.l; });
                if(configFound.length > 0) {
                    return (typeof(row.source) === "undefined" ? "dbk" : row.source) === configFound[0].source;
                } else {
                    return true;
                }
            })
            .map(function(row) {
                return { l: row.l, t: row.t, html: row.html, };
            });
    },

    orderObjectInfoRows: function(rows) {
        var me = dbkjs.modules.kro;

        return rows
            .map(function(row) {
                var configFound = me.rowConfig.filter(function(cr) { return cr.label === row.l; });
                var order = 999;
                if(configFound.length > 0) {
                    order = configFound[0].order;
                }
                return { l: row.l, t: row.t, html: row.html, o: order, }
            })
            .sort(function(a, b) { return a.o - b.o; })
            .map(function(row) {
                return { l: row.l, t: row.t, html: row.html, };
            });
    },

    createAddressString: function(streetname, housenr, houseletter, houseaddition, city) {
        return `${ streetname }|${ (housenr === 0 ? '' : housenr) || '' }|${ houseletter || '' }|${ houseaddition || '' }|${ city }`;
    },
}
