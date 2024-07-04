import { BladesSheet } from "./blades-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { BladesHelpers } from "./blades-helpers.js";

/**
 * @extends {BladesSheet}
 */
export class BladesCrewSheet extends BladesSheet {

  /** @override */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
  	  classes: ["blades-in-the-dark", "sheet", "actor", "crew"],
  	  template: "systems/blades-in-the-dark/templates/crew-sheet.html",
      width: 940,
      height: 940,
      tabs: [{navSelector: ".tabs", contentSelector: ".tab-content", initial: "turfs"}]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options) {
    const superData = super.getData( options );
    const sheetData = superData.data;
    sheetData.owner = superData.owner;
    sheetData.editable = superData.editable;
    sheetData.isGM = game.user.isGM;
	
    // Prepare active effects
    sheetData.effects = BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects);

    // Calculate Turfs amount.
    let turfs_amount = 0;
	let turfs_max = sheetData.system.turf.max;

    sheetData.items.forEach(item => {

      if (item.type === "crew_type") {
        Object.entries(item.system.turfs).forEach(([key, turf]) => {
          if (turf.name === 'BITD.Turf') {
            turfs_amount += (turf.value === true) ? 1 : 0;
          }
        });
      }

    });
	
	turfs_amount = turfs_amount + sheetData.system.turf.bonus;
	if (turfs_amount > turfs_max) {turfs_amount = turfs_max;};
    sheetData.system.turfs_amount = turfs_amount;
	
	//return data
    return sheetData;
	
  }
  
  /** @override **/
  async _onDropActor(event, droppedActor){
    await super._onDropActor(event, droppedActor);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this character. Please speak to your GM if you feel you have reached this message in error.`, {permanent: true});
      return false;
    }
    await this.handleDrop(event, droppedActor);
  }  
  
  /** @override **/
  async handleDrop(event, droppedEntity){
    let droppedEntityFull = await fromUuid(droppedEntity.uuid);
    switch (droppedEntityFull.type) {
      case "npc":
        await BladesHelpers.addAcquaintance(this.actor, droppedEntityFull);
        break;
      case "item":
        break;
      case "crew_type":
        break;
      case "ability":
        break;
      case "class":
        break ;
      default:
        break;
    }
  }
  /* -------------------------------------------- */

  /** @override */
	activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Add Crew Type
    html.find(".crew-class").click(this._onItemAddClick.bind(this));


    // Update Inventory Item
    html.find('.item-sheet-open').click(ev => {
      const element = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(element.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.item-delete').click( async ev => {
      const element = $(ev.currentTarget).parents(".item");
      await this.actor.deleteEmbeddedDocuments("Item", [element.data("itemId")]);
      element.slideUp(200, () => this.render(false));
    });
	
    // manage active effects
    html.find(".effect-control").click(ev => BladesActiveEffect.onManageActiveEffect(ev, this.actor));

    // Add a new Cohort
    html.find('.add-item').click(ev => {
      BladesHelpers._addOwnedItem(ev, this.actor);
    });

    // Toggle Turf
    html.find('.turf-select').click( async ev => {
      const element = $(ev.currentTarget).parents(".item");

      let item_id = element.data("itemId")
      let turf_id = $(ev.currentTarget).data("turfId");
      let turf_current_status = $(ev.currentTarget).data("turfStatus");
      let turf_checkbox_name = 'system.turfs.' + turf_id + '.value';

      await this.actor.updateEmbeddedDocuments('Item', [{
        _id: item_id,
        [turf_checkbox_name]: !turf_current_status}]);
      this.render(false);
    });

    // Cohort Block Harm handler
    html.find('.cohort-block-harm input[type="radio"]').change( async ev => {
      const element = $(ev.currentTarget).parents(".item");

      let item_id = element.data("itemId")
      let harm_id = $(ev.currentTarget).val();

      await this.actor.updateEmbeddedDocuments('Item', [{
        _id: item_id,
        "system.harm": [harm_id]}]);
      this.render(false);
    });
	
	// acquaintance status toggle
    html.find('.standing-toggle').click(ev => {
      let acquaintances = this.actor.system.acquaintances;
      let acqId = ev.target.closest('.acquaintance').dataset.acquaintance;
      let clickedAcqIdx = acquaintances.findIndex(item => item.id == acqId);
      let clickedAcq = acquaintances[clickedAcqIdx];
      let oldStanding = clickedAcq.standing;
      let newStanding;
      switch(oldStanding){
        case "friend":
          newStanding = "rival";
          break;
        case "rival":
          newStanding = "neutral";
          break;
        case "neutral":
          newStanding = "friend";
          break;
      }
      clickedAcq.standing = newStanding;
      acquaintances.splice(clickedAcqIdx, 1, clickedAcq);
      this.actor.update({system: {acquaintances : acquaintances}});
    });
	
	  // Open Acquaintance
    html.find('.open-friend').click(ev => {
      const element = $(ev.currentTarget).parents(".item");
      const actor = game.actors.get(element.data("itemId"));
      actor?.sheet.render(true);
    });
	
	// Remove Acquaintance from character sheet
    html.find('.acquaintance-delete').click(ev => {
      //let acqId = ev.target.closest('.acquaintance').dataset.acquaintance; //used when <div class="acquaintance"
	  const element = $(ev.currentTarget).parents(".item");
	  let acqId = element.data("itemId");
	  BladesHelpers.removeAcquaintance(this.actor, acqId);
    });

	  // Import Acquaintance by playbook
    html.find('.import-contacts').click(ev => {
	  const playbook = this.actor.items.filter(i=> i.type === "crew_type")[0]?.name;
	  BladesHelpers.import_pb_contacts(this.actor, playbook);

    });

  }


  /* -------------------------------------------- */
  /*  Form Submission                             */
	/* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {

    // Update the Item
    await super._updateObject(event, formData);

    if (event.target && event.target.name === "system.tier") {
      this.render(true);
    }
  }
  /* -------------------------------------------- */

}
